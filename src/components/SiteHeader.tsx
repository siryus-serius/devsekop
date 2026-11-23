import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-sm">
        <Link href="/" className="mr-auto font-semibold text-brand-900">
          🎓 Vault Ijazah Digital
        </Link>
        <Link href="/verify" className="text-slate-600 hover:text-brand-700">
          Verifikasi
        </Link>
        {user ? (
          <>
            <Link href="/vault" className="text-slate-600 hover:text-brand-700">
              Vault Saya
            </Link>
            <Link href="/issuer" className="text-slate-600 hover:text-brand-700">
              Issuer
            </Link>
            <form action="/auth/signout" method="post">
              <button className="text-slate-600 hover:text-red-700">Keluar</button>
            </form>
          </>
        ) : (
          <Link href="/login" className="btn-primary">
            Masuk
          </Link>
        )}
      </nav>
    </header>
  );
}
