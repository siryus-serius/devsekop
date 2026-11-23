import { z } from "zod";
import type { Hex } from "viem";
import { audit } from "@/lib/audit";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { proposeRevoke } from "@/lib/chain/registry";
import { clientIp } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mengusulkan pencabutan ijazah (memerlukan persetujuan multi-sig on-chain). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireRole(["issuer"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "ID tidak valid." }, { status: 400 });

  const { data: diploma } = await ctx.supabase
    .from("diplomas")
    .select("id, serial_key, status")
    .eq("id", id)
    .single();
  if (!diploma) return Response.json({ error: "Ijazah tidak ditemukan." }, { status: 404 });
  if (diploma.status !== "issued") {
    return Response.json({ error: "Hanya ijazah berstatus terbit yang dapat dicabut." }, { status: 409 });
  }

  try {
    const outcome = await proposeRevoke(diploma.serial_key as Hex);
    if (outcome.executed) {
      await createSupabaseAdminClient().from("diplomas").update({ status: "revoked" }).eq("id", id);
    }
    await audit({
      actorId: ctx.userId,
      action: "diploma.revoke_proposed",
      targetType: "diploma",
      targetId: id,
      metadata: { proposalId: outcome.proposalId.toString(), txHash: outcome.txHash, executed: outcome.executed },
      ip: clientIp(request.headers),
    });
    return Response.json({
      id,
      executed: outcome.executed,
      proposalId: outcome.proposalId.toString(),
      txHash: outcome.txHash,
    });
  } catch (err) {
    console.error("[revoke] gagal:", err);
    return Response.json({ error: "Gagal mengirim proposal pencabutan." }, { status: 502 });
  }
}
