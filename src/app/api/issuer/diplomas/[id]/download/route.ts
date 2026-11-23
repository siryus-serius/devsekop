import { z } from "zod";
import { audit } from "@/lib/audit";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { clientIp } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unduh PDF dari vault: cek peran, lalu redirect ke signed URL yang berlaku 60 detik. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireRole(["issuer", "admin"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "ID tidak valid." }, { status: 400 });

  const { data: diploma } = await ctx.supabase.from("diplomas").select("storage_path").eq("id", id).single();
  if (!diploma) return Response.json({ error: "Ijazah tidak ditemukan." }, { status: 404 });

  const { data, error } = await createSupabaseAdminClient()
    .storage.from("diplomas")
    .createSignedUrl(diploma.storage_path as string, 60, { download: true });
  if (error || !data) return Response.json({ error: "Gagal membuat tautan unduhan." }, { status: 500 });

  await audit({ action: "diploma.downloaded", actorId: ctx.userId, targetId: id, ip: clientIp(request.headers) });
  return Response.redirect(data.signedUrl, 302);
}
