import { z } from "zod";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { verifyBySerial } from "@/lib/chain/registry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Menyelaraskan status di database dengan status on-chain (sumber kebenaran = blockchain). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireRole(["issuer", "admin"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "ID tidak valid." }, { status: 400 });

  // Dibaca dengan klien sesi pengguna => RLS membatasi ke institusi issuer.
  const { data: diploma } = await ctx.supabase
    .from("diplomas")
    .select("id, serial_number, status")
    .eq("id", id)
    .single();
  if (!diploma) return Response.json({ error: "Ijazah tidak ditemukan." }, { status: 404 });

  const onChain = await verifyBySerial(diploma.serial_number as string);
  const status =
    onChain.status === "valid" ? "issued" : onChain.status === "revoked" ? "revoked" : (diploma.status as string);

  if (status !== diploma.status) {
    await createSupabaseAdminClient().from("diplomas").update({ status }).eq("id", id);
  }
  return Response.json({ id, status, onChain: onChain.status });
}
