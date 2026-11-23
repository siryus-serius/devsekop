/**
 * IP klien untuk rate limiting & audit. Header X-Forwarded-For hanya dapat dipercaya
 * bila aplikasi berada di belakang proxy tepercaya (Vercel, Cloudflare, API Gateway)
 * yang menimpa header tersebut. Jangan ekspos server Next.js langsung ke internet.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
