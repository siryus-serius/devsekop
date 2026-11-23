const LABELS: Record<string, { text: string; cls: string }> = {
  draft: { text: "Draf", cls: "bg-slate-100 text-slate-700" },
  pending_approval: { text: "Menunggu persetujuan", cls: "bg-amber-100 text-amber-800" },
  issued: { text: "Terbit", cls: "bg-emerald-100 text-emerald-800" },
  revoked: { text: "Dicabut", cls: "bg-red-100 text-red-800" },
  failed: { text: "Gagal", cls: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = LABELS[status] ?? { text: status, cls: "bg-slate-100 text-slate-700" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.text}</span>;
}
