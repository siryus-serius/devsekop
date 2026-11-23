import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiplomaActions } from "@/components/DiplomaActions";
import { IssueForm } from "@/components/IssueForm";
import { StatusBadge } from "@/components/StatusBadge";
import { AuthError, requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Dasbor Issuer", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function IssuerPage() {
  let ctx;
  try {
    ctx = await requireRole(["issuer"]);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/login?next=/issuer");
    if (err instanceof AuthError && err.status === 403) {
      return (
        <div className="card">
          <h1 className="text-xl font-semibold text-brand-900">Akses ditolak</h1>
          <p className="text-slate-600">Halaman ini hanya untuk akun issuer (universitas).</p>
        </div>
      );
    }
    throw err;
  }

  // RLS membatasi hasil ke institusi issuer ini.
  const { data: diplomas } = await ctx.supabase
    .from("diplomas")
    .select("id, serial_number, holder_name, program, status, proposal_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-brand-900">Dasbor Issuer</h1>
        <p className="text-slate-600">
          Penerbitan membutuhkan persetujuan multi-signature. Hanya hash dokumen yang dicatat di blockchain.
        </p>
      </header>

      <IssueForm />

      <section className="card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold text-brand-900">Ijazah Institusi</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500 uppercase">
            <tr>
              <th className="py-2 pr-4">No. seri</th>
              <th className="py-2 pr-4">Nama</th>
              <th className="py-2 pr-4">Program</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {diplomas?.map((d) => (
              <tr key={d.id as string}>
                <td className="py-3 pr-4 font-mono text-xs">{d.serial_number as string}</td>
                <td className="py-3 pr-4">{d.holder_name as string}</td>
                <td className="py-3 pr-4">{d.program as string}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={d.status as string} />
                  {d.status === "pending_approval" && d.proposal_id && (
                    <span className="ml-2 text-xs text-slate-500">proposal #{d.proposal_id as string}</span>
                  )}
                </td>
                <td className="py-3">
                  <DiplomaActions id={d.id as string} status={d.status as string} />
                </td>
              </tr>
            ))}
            {!diplomas?.length && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  Belum ada ijazah.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
