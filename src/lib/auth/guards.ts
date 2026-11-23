import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "holder" | "issuer" | "admin";

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
  role: AppRole;
  institutionId: string | null;
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
 * Otorisasi server-side (REQ-03 & REQ-06):
 *  1. JWT divalidasi ke Supabase Auth (getUser, bukan getSession dari cookie).
 *  2. Sesi wajib AAL2 (MFA terverifikasi).
 *  3. Peran dibaca dari tabel profiles (bukan dari klaim yang dapat dimanipulasi klien).
 */
export async function requireRole(allowed: readonly AppRole[]): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError(401, "Tidak terautentikasi.");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") throw new AuthError(401, "Verifikasi MFA diperlukan.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, institution_id, email")
    .eq("id", user.id)
    .single();
  if (!profile || !allowed.includes(profile.role as AppRole)) throw new AuthError(403, "Akses ditolak.");

  return {
    supabase,
    userId: user.id,
    email: profile.email as string,
    role: profile.role as AppRole,
    institutionId: (profile.institution_id as string | null) ?? null,
  };
}

export function authErrorResponse(err: unknown): Response | null {
  if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
  return null;
}
