import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { getIssuanceDigest, proposeIssue, serialKeyOf } from "@/lib/chain/registry";
import { aesGcmEncrypt } from "@/lib/crypto/aes";
import { sha256Hex } from "@/lib/crypto/hash";
import { serverEnv } from "@/lib/env";
import { kms } from "@/lib/kms";
import { FileRejectedError, scanForMalware, validatePdf } from "@/lib/security/file-validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "diplomas";

const fieldsSchema = z.object({
  serialNumber: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9\-/._]+$/, "Nomor seri tidak valid"),
  holderEmail: z.string().trim().toLowerCase().email().max(254),
  holderName: z.string().trim().min(2).max(200),
  program: z.string().trim().min(2).max(200),
  graduationDate: z.string().date(),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK harus 16 digit")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  gpa: z
    .string()
    .trim()
    .regex(/^[0-4](\.\d{1,2})?$/, "IPK tidak valid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Alur penerbitan (Issuance / Minting):
 * validasi → pindai malware → SHA-256 → enkripsi AES-256-GCM → simpan off-chain →
 * tanda tangan KMS → proposal multi-sig on-chain (hanya hash + kunci seri + tanda tangan).
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole(["issuer"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }
  if (!ctx.institutionId) return Response.json({ error: "Akun issuer belum terhubung ke institusi." }, { status: 403 });

  const env = serverEnv();
  const ip = clientIp(request.headers);
  if (!rateLimit(`issue:${ctx.userId}`, 30, 60_000).allowed) {
    return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > env.MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "Ukuran unggahan melebihi batas." }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return Response.json({ error: "File PDF wajib diunggah." }, { status: 400 });

  const parsed = fieldsSchema.safeParse(Object.fromEntries([...form.entries()].filter(([k]) => k !== "file")));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Input tidak valid." }, { status: 400 });
  }
  const fields = parsed.data;

  const pdf = Buffer.from(await file.arrayBuffer());
  try {
    validatePdf(pdf);
    await scanForMalware(pdf);
  } catch (err) {
    if (err instanceof FileRejectedError) {
      await audit({ actorId: ctx.userId, action: "diploma.upload_rejected", metadata: { reason: err.message }, ip });
      return Response.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const docHash = sha256Hex(pdf);
  const serialKey = serialKeyOf(fields.serialNumber);
  const admin = createSupabaseAdminClient();

  const { data: dup } = await admin
    .from("diplomas")
    .select("id")
    .or(`serial_key.eq.${serialKey},doc_hash.eq.${docHash}`)
    .limit(1);
  if (dup && dup.length > 0) {
    return Response.json({ error: "Nomor seri atau dokumen ini sudah pernah diterbitkan." }, { status: 409 });
  }

  // 1) Enkripsi envelope: DEK unik per file, dibungkus kunci master KMS.
  const { plaintext: dek, wrapped } = await kms().generateDataKey(serialKey);
  const encrypted = aesGcmEncrypt(dek, pdf, `diploma:${serialKey}`);
  dek.fill(0);

  const storagePath = `${ctx.institutionId}/${randomUUID()}.bin`;
  const upload = await admin.storage
    .from(BUCKET)
    .upload(storagePath, encrypted, { contentType: "application/octet-stream", upsert: false });
  if (upload.error) {
    console.error("[issue] upload gagal:", upload.error.message);
    return Response.json({ error: "Gagal menyimpan dokumen." }, { status: 500 });
  }

  // 2) Simpan metadata + PII terenkripsi (off-chain).
  const { data: row, error: insertError } = await admin
    .from("diplomas")
    .insert({
      institution_id: ctx.institutionId,
      holder_email: fields.holderEmail,
      holder_name: fields.holderName,
      program: fields.program,
      graduation_date: fields.graduationDate,
      serial_number: fields.serialNumber,
      serial_key: serialKey,
      doc_hash: docHash,
      nik_encrypted: fields.nik ? await kms().encryptField(fields.nik, `nik:${serialKey}`) : null,
      gpa_encrypted: fields.gpa ? await kms().encryptField(fields.gpa, `gpa:${serialKey}`) : null,
      storage_path: storagePath,
      wrapped_dek: wrapped,
      status: "draft",
      issued_by: ctx.userId,
    })
    .select("id")
    .single();
  if (insertError || !row) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    const conflict = insertError?.code === "23505";
    return Response.json(
      { error: conflict ? "Nomor seri atau dokumen sudah terdaftar." : "Gagal menyimpan metadata." },
      { status: conflict ? 409 : 500 },
    );
  }

  // 3) Tanda tangan KMS + proposal multi-sig on-chain.
  try {
    const digest = await getIssuanceDigest(serialKey, docHash);
    const signature = await kms().signDigest(digest);
    const outcome = await proposeIssue(serialKey, docHash, signature);

    const status = outcome.executed ? "issued" : "pending_approval";
    await admin
      .from("diplomas")
      .update({
        issuer_signature: signature,
        status,
        proposal_id: outcome.proposalId.toString(),
        tx_hash: outcome.txHash,
      })
      .eq("id", row.id);

    // Tautkan ke akun holder yang sudah ada dan terkonfirmasi.
    await admin.rpc("link_diploma_to_existing_holder", { p_diploma_id: row.id });

    await audit({
      actorId: ctx.userId,
      action: "diploma.issue_proposed",
      targetType: "diploma",
      targetId: row.id,
      metadata: { serialKey, docHash, proposalId: outcome.proposalId.toString(), txHash: outcome.txHash, status },
      ip,
    });

    return Response.json(
      { id: row.id, status, docHash, serialKey, proposalId: outcome.proposalId.toString(), txHash: outcome.txHash },
      { status: 201 },
    );
  } catch (err) {
    console.error("[issue] gagal on-chain:", err);
    await admin.from("diplomas").delete().eq("id", row.id);
    await admin.storage.from(BUCKET).remove([storagePath]);
    await audit({
      actorId: ctx.userId,
      action: "diploma.issue_failed",
      metadata: { serialKey, docHash, error: err instanceof Error ? err.message.slice(0, 300) : "unknown" },
      ip,
    });
    return Response.json({ error: "Gagal mencatat ke blockchain. Tidak ada data yang disimpan." }, { status: 502 });
  }
}
