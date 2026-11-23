import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { hmacHex } from "@/lib/crypto/hash";
import { serverEnv } from "@/lib/env";
import { clientIp } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    diplomaId: z.string().uuid(),
    expiresInDays: z.number().int().min(1).max(90).default(30),
  })
  .strict();

/** Membuat tautan verifikasi + QR code yang bisa dibagikan, berumur terbatas & dapat dicabut. */
export async function POST(request: Request) {
  let ctx;
  try {
    // Kepemilikan ijazah ditegakkan oleh kebijakan RLS share_links_insert_own.
    ctx = await requireRole(["holder", "issuer", "admin"]);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: "Kesalahan server." }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Input tidak valid." }, { status: 400 });

  const env = serverEnv();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000);

  // Insert dengan klien sesi pengguna: kebijakan RLS memastikan ijazah milik pengguna & berstatus terbit.
  const { data, error } = await ctx.supabase
    .from("share_links")
    .insert({
      diploma_id: parsed.data.diplomaId,
      created_by: ctx.userId,
      token_hash: hmacHex(env.SHARE_TOKEN_PEPPER, token),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return Response.json({ error: "Tidak dapat membuat tautan untuk ijazah ini." }, { status: 403 });

  const url = `${env.NEXT_PUBLIC_APP_URL}/share/${token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 320 });

  await audit({
    actorId: ctx.userId,
    action: "share_link.created",
    targetType: "diploma",
    targetId: parsed.data.diplomaId,
    metadata: { shareLinkId: data.id, expiresAt: expiresAt.toISOString() },
    ip: clientIp(request.headers),
  });

  return Response.json({ id: data.id, url, qrDataUrl, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
