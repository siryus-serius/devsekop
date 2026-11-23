/** Mencegah open redirect: hanya path relatif internal yang diizinkan. */
export function safeNextPath(next: string | null | undefined, fallback = "/vault"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
