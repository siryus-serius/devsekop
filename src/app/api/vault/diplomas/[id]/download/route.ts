import { z } from "zod";
import { audit } from "@/lib/audit";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { aesGcmDecrypt } from "@/lib/crypto/aes";
import { constantTimeEqual, sha256Hex } from "@/lib/crypto/hash";
import { kms } from "@/lib/kms";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unduhan aman: kepemilikan dicek, file didekripsi di server, integritas dicocokkan dengan hash. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    // Semua peran boleh, tetapi kepemilikan (holder_id) dicek di query + RLS.
    ctx = await requireRole(["holder", "issuer", "admin"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }
  if (!rateLimit(`download:${ctx.userId}`, 20, 60_000).allowed) {
    return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "ID tidak valid." }, { status: 400 });

  // RLS + filter eksplisit holder_id: hanya pemilik yang dapat mengunduh.
  const { data: diploma } = await ctx.supabase
    .from("diplomas")
    .select("id, serial_number, serial_key, doc_hash, storage_path, wrapped_dek")
    .eq("id", id)
    .eq("holder_id", ctx.userId)
    .single();
  if (!diploma) return Response.json({ error: "Ijazah tidak ditemukan." }, { status: 404 });

  const { data: blob, error } = await createSupabaseAdminClient().storage
    .from("diplomas")
    .download(diploma.storage_path as string);
  if (error || !blob) return Response.json({ error: "Dokumen tidak tersedia." }, { status: 404 });

  const serialKey = diploma.serial_key as string;
  const dek = await kms().unwrapDataKey(diploma.wrapped_dek as string, serialKey);
  let pdf: Buffer;
  try {
    pdf = aesGcmDecrypt(dek, Buffer.from(await blob.arrayBuffer()), `diploma:${serialKey}`);
  } finally {
    dek.fill(0);
  }

  if (!constantTimeEqual(sha256Hex(pdf), diploma.doc_hash as string)) {
    console.error(`[download] integritas gagal untuk ijazah ${id}`);
    return Response.json({ error: "Pemeriksaan integritas dokumen gagal." }, { status: 500 });
  }

  await audit({
    actorId: ctx.userId,
    action: "diploma.downloaded",
    targetType: "diploma",
    targetId: id,
    ip: clientIp(request.headers),
  });

  const filename = `ijazah-${(diploma.serial_number as string).replace(/[^A-Za-z0-9-]/g, "_")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
