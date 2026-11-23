import { z } from "zod";
import type { Hex } from "viem";
import { verifyByHash, verifyBySerial } from "@/lib/chain/registry";
import { serverEnv } from "@/lib/env";
import { rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mesin verifikasi publik, read-only, tanpa login (REQ-05).
 * Klien menghitung SHA-256 PDF di browser dan hanya mengirim hash —
 * dokumen verifier tidak pernah meninggalkan perangkatnya (privacy by design).
 */
const bodySchema = z.union([
  z.object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).strict(),
  z.object({ serial: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9\-/._]+$/) }).strict(),
]);

export async function POST(request: Request) {
  const env = serverEnv();
  const limit = rateLimit(`verify:${clientIp(request.headers)}`, env.RATE_LIMIT_VERIFY_MAX, env.RATE_LIMIT_WINDOW_MS);
  const headers = rateLimitHeaders(limit, env.RATE_LIMIT_VERIFY_MAX);
  if (!limit.allowed) {
    return Response.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429, headers });
  }

  if (Number(request.headers.get("content-length") ?? 0) > 1024) {
    return Response.json({ error: "Payload terlalu besar." }, { status: 413, headers });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Input tidak valid." }, { status: 400, headers });
  }

  try {
    const result =
      "hash" in parsed.data
        ? await verifyByHash(parsed.data.hash.toLowerCase() as Hex)
        : await verifyBySerial(parsed.data.serial);
    return Response.json(result, { headers });
  } catch (err) {
    console.error("[verify] gagal membaca blockchain:", err);
    return Response.json({ error: "Layanan verifikasi sedang tidak tersedia." }, { status: 503, headers });
  }
}
