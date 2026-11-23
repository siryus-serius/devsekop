import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { explorerTxUrl, issueOnChain, serialKeyOf } from "@/lib/chain/registry";
import { sha256Hex } from "@/lib/crypto/hash";
import { serverEnv } from "@/lib/env";
import { FileRejectedError, validatePdf } from "@/lib/security/file-validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "diplomas";

const fieldsSchema = z.object({
  serialNumber: z.string().trim().regex(/^[A-Za-z0-9./_-]{3,64}$/, "Nomor seri tidak valid"),
  studentName: z.string().trim().min(2).max(120),
  studentNumber: z.string().trim().regex(/^[A-Za-z0-9-]{3,32}$/, "NIM tidak valid"),
  program: z.string().trim().min(2).max(120),
  graduationDate: z.string().date(),
});

/**
 * Penerbitan ijazah:
 *   validasi PDF → hash SHA-256 → simpan PDF di bucket privat → catat hash on-chain → simpan metadata.
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole(["issuer", "admin"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }

  const env = serverEnv();
  const ip = clientIp(request.headers);
  if (!rateLimit(`issue:${ctx.userId}`, 30, 60_000).allowed) {
    return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > env.MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "Ukuran unggahan melebihi batas." }, { status: 413 });
  }

  // 1) Validasi input
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
  } catch (err) {
    if (err instanceof FileRejectedError) {
      await audit({ action: "diploma.upload_rejected", level: "warning", actorId: ctx.userId, ip, metadata: { reason: err.message } });
      return Response.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  // 2) Hitung sidik jari dokumen
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

  // 3) Simpan PDF di bucket privat (vault)
  const storagePath = `${new Date().getFullYear()}/${randomUUID()}.pdf`;
  const upload = await admin.storage.from(BUCKET).upload(storagePath, pdf, { contentType: "application/pdf" });
  if (upload.error) {
    console.error("[issue] upload gagal:", upload.error.message);
    return Response.json({ error: "Gagal menyimpan dokumen." }, { status: 500 });
  }

  // 4) Catat hash ke blockchain
  let txHash: string;
  try {
    txHash = await issueOnChain(serialKey, docHash);
  } catch (err) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    await audit({
      action: "diploma.issue_failed",
      level: "warning",
      actorId: ctx.userId,
      ip,
      metadata: { serialKey, error: err instanceof Error ? err.message.slice(0, 300) : "unknown" },
    });
    return Response.json({ error: "Gagal mencatat ke blockchain. Tidak ada data yang disimpan." }, { status: 502 });
  }

  // 5) Simpan metadata
  const { data: row, error: insertError } = await admin
    .from("diplomas")
    .insert({
      serial_number: fields.serialNumber,
      student_name: fields.studentName,
      student_number: fields.studentNumber,
      program: fields.program,
      graduation_date: fields.graduationDate,
      storage_path: storagePath,
      serial_key: serialKey,
      doc_hash: docHash,
      tx_hash: txHash,
      issued_by: ctx.userId,
    })
    .select("id")
    .single();
  if (insertError || !row) {
    // Blockchain adalah sumber kebenaran: ijazah tetap valid on-chain, metadata perlu dicatat ulang.
    await audit({ action: "diploma.metadata_failed", level: "critical", actorId: ctx.userId, ip, metadata: { serialKey, txHash } });
    return Response.json({ error: "Tercatat di blockchain, tetapi gagal menyimpan metadata." }, { status: 500 });
  }

  await audit({ action: "diploma.issued", actorId: ctx.userId, targetId: row.id, ip, metadata: { serialKey, docHash, txHash } });

  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify/${encodeURIComponent(fields.serialNumber)}`;
  return Response.json(
    {
      id: row.id,
      docHash,
      txHash,
      explorerUrl: explorerTxUrl(txHash),
      verifyUrl,
      qr: await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 }),
    },
    { status: 201 },
  );
}
