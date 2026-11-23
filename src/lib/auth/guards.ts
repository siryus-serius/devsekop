import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "issuer" | "admin";

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
  role: AppRole;
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Otorisasi server-side:
 *  1. JWT divalidasi ke Supabase Auth (getUser, bukan sekadar membaca cookie).
 *  2. Sesi wajib AAL2 (MFA terverifikasi).
 *  3. Peran dibaca dari tabel profiles, bukan dari data yang dikirim klien.
 */
export async function requireRole(allowed: readonly AppRole[]): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError(401, "Tidak terautentikasi.");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") throw new AuthError(401, "Verifikasi MFA diperlukan.");

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  const role = profile?.role as AppRole | null | undefined;
  if (!role || !allowed.includes(role)) throw new AuthError(403, "Akses ditolak.");

  return { supabase, userId: user.id, email: profile!.email as string, role };
}

export function authErrorResponse(err: unknown): Response | null {
  if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
  return null;
}
