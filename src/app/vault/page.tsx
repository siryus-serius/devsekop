import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShareButton } from "@/components/ShareButton";
import { StatusBadge } from "@/components/StatusBadge";
import { AuthError, requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Vault Saya", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VaultPage() {
  let ctx;
  try {
    ctx = await requireRole(["holder", "issuer", "admin"]);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/login?next=/vault");
    throw err;
  }

  // Klien sesi pengguna => RLS hanya mengembalikan ijazah milik pengguna ini.
  const { data: diplomas } = await ctx.supabase
    .from("diplomas")
    .select("id, serial_number, program, graduation_date, status, doc_hash, institutions(name)")
    .eq("holder_id", ctx.userId)
    .order("graduation_date", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-brand-900">Vault Ijazah Saya</h1>
        <p className="text-slate-600">Ijazah yang diterbitkan untuk {ctx.email}.</p>
      </header>

      {!diplomas?.length ? (
        <div className="card text-center text-slate-600">
          Belum ada ijazah. Ijazah akan muncul otomatis setelah diterbitkan institusi ke email terverifikasi Anda.
        </div>
      ) : (
        <ul className="space-y-4">
          {diplomas.map((d) => (
            <li key={d.id as string} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-brand-900">{d.program as string}</h2>
                  <p className="text-sm text-slate-600">
                    {(d.institutions as unknown as { name: string } | null)?.name} · Lulus{" "}
                    {new Date(d.graduation_date as string).toLocaleDateString("id-ID", { dateStyle: "long" })}
                  </p>
                  <p className="font-mono text-xs text-slate-500">No. seri: {d.serial_number as string}</p>
                </div>
                <StatusBadge status={d.status as string} />
              </div>
              {d.status === "issued" && (
                <div className="flex flex-wrap items-center gap-2">
                  <a className="btn-primary" href={`/api/vault/diplomas/${d.id}/download`}>
                    Unduh PDF
                  </a>
                  <a className="btn-secondary" href={`/verify/${encodeURIComponent(d.serial_number as string)}`}>
                    Lihat Verifikasi
                  </a>
                  <ShareButton diplomaId={d.id as string} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
