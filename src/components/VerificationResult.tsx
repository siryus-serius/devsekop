import type { VerificationResult as Result } from "@/lib/chain/registry";

const STYLES = {
  valid: {
    box: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-800",
    icon: "✅",
    label: "Asli & Valid",
    desc: "Hash dokumen cocok dengan catatan yang tidak dapat diubah di blockchain.",
  },
  revoked: {
    box: "border-amber-200 bg-amber-50",
    title: "text-amber-800",
    icon: "⛔",
    label: "Dicabut",
    desc: "Ijazah ini pernah diterbitkan tetapi telah dicabut oleh institusi penerbit.",
  },
  not_found: {
    box: "border-red-200 bg-red-50",
    title: "text-red-800",
    icon: "❌",
    label: "Tidak Valid / Dipalsukan",
    desc: "Tidak ada catatan yang cocok di blockchain. Dokumen mungkin telah diubah atau tidak pernah diterbitkan.",
  },
} as const;

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) : "-";
}

export function VerificationResult({
  result,
  details,
}: {
  result: Pick<Result, "status" | "docHash" | "issuedAt" | "revokedAt" | "signer" | "signerIsCurrentIssuer" | "registry" | "chainId">;
  details?: { label: string; value: string }[];
}) {
  const s = STYLES[result.status];
  return (
    <div className={`rounded-2xl border p-6 ${s.box}`} role="status" aria-live="polite">
      <h2 className={`text-xl font-bold ${s.title}`}>
        <span aria-hidden>{s.icon}</span> {s.label}
      </h2>
      <p className="mt-1 text-sm text-slate-700">{s.desc}</p>

      {result.status !== "not_found" && (
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          {details?.map((d) => (
            <div key={d.label} className="contents">
              <dt className="font-medium text-slate-600">{d.label}</dt>
              <dd className="text-slate-900">{d.value}</dd>
            </div>
          ))}
          <dt className="font-medium text-slate-600">Diterbitkan</dt>
          <dd>{formatDate(result.issuedAt)}</dd>
          {result.revokedAt && (
            <>
              <dt className="font-medium text-slate-600">Dicabut</dt>
              <dd>{formatDate(result.revokedAt)}</dd>
            </>
          )}
          <dt className="font-medium text-slate-600">Hash SHA-256</dt>
          <dd className="font-mono text-xs break-all">{result.docHash}</dd>
          <dt className="font-medium text-slate-600">Penanda tangan</dt>
          <dd className="font-mono text-xs break-all">
            {result.signer} {result.signerIsCurrentIssuer ? "(kunci issuer aktif)" : "(kunci issuer sebelumnya)"}
          </dd>
          <dt className="font-medium text-slate-600">Kontrak</dt>
          <dd className="font-mono text-xs break-all">
            {result.registry} (chain {result.chainId})
          </dd>
        </dl>
      )}
    </div>
  );
}
