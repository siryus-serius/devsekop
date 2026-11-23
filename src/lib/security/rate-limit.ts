import "server-only";

/**
 * Rate limiter fixed-window di memori (REQ-05).
 * ⚠️ Per-instance: pada deployment multi-instance/serverless gunakan store terdistribusi
 * (mis. Upstash Redis / Vercel KV) DAN aturan rate limit di WAF/API Gateway sebagai lapisan pertama.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return { allowed: bucket.count <= max, remaining: Math.max(0, max - bucket.count), resetAt: bucket.resetAt };
}

function sweep(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  // Jika masih penuh (serangan banyak IP), kosongkan agar memori tetap terbatas.
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

export function rateLimitHeaders(r: RateLimitResult, max: number): Record<string, string> {
  return {
    "RateLimit-Limit": String(max),
    "RateLimit-Remaining": String(r.remaining),
    "RateLimit-Reset": String(Math.ceil((r.resetAt - Date.now()) / 1000)),
    ...(r.allowed ? {} : { "Retry-After": String(Math.ceil((r.resetAt - Date.now()) / 1000)) }),
  };
}
