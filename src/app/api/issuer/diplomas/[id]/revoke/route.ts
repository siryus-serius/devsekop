import { z } from "zod";
import type { Hex } from "viem";
import { audit } from "@/lib/audit";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { explorerTxUrl, revokeOnChain } from "@/lib/chain/registry";
import { clientIp } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mencabut ijazah (khusus admin). Catatan penerbitan di blockchain tetap ada. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireRole(["admin"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "ID tidak valid." }, { status: 400 });

  const { data: diploma } = await ctx.supabase.from("diplomas").select("serial_key, status").eq("id", id).single();
  if (!diploma) return Response.json({ error: "Ijazah tidak ditemukan." }, { status: 404 });
  if (diploma.status !== "issued") return Response.json({ error: "Ijazah sudah dicabut." }, { status: 409 });

  const ip = clientIp(request.headers);
  try {
    const txHash = await revokeOnChain(diploma.serial_key as Hex);
    await createSupabaseAdminClient()
      .from("diplomas")
      .update({ status: "revoked", revoked_by: ctx.userId, revoked_at: new Date().toISOString(), revoke_tx_hash: txHash })
      .eq("id", id);
    await audit({ action: "diploma.revoked", level: "warning", actorId: ctx.userId, targetId: id, ip, metadata: { txHash } });
    return Response.json({ id, txHash, explorerUrl: explorerTxUrl(txHash) });
  } catch (err) {
    console.error("[revoke] gagal:", err);
    return Response.json({ error: "Gagal mencabut ijazah di blockchain." }, { status: 502 });
  }
}
