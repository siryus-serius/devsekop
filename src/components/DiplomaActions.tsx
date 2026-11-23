"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DiplomaActions({
  id,
  serial,
  status,
  canRevoke,
}: {
  id: string;
  serial: string;
  status: string;
  canRevoke: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function revoke() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/issuer/diplomas/${id}/revoke`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return setNote(body.error ?? "Gagal.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <a className="btn-secondary px-3 py-1" href={`/api/issuer/diplomas/${id}/download`}>
        PDF
      </a>
      <Link className="btn-secondary px-3 py-1" href={`/verify/${encodeURIComponent(serial)}`}>
        Cek
      </Link>
      {canRevoke && status === "issued" && !confirming && (
        <button className="btn-danger px-3 py-1" onClick={() => setConfirming(true)}>
          Cabut
        </button>
      )}
      {confirming && (
        <>
          <span className="text-slate-600">Cabut permanen?</span>
          <button className="btn-danger px-3 py-1" onClick={revoke} disabled={busy}>
            {busy ? "Memproses…" : "Ya, cabut"}
          </button>
          <button className="btn-secondary px-3 py-1" onClick={() => setConfirming(false)} disabled={busy}>
            Batal
          </button>
        </>
      )}
      {note && <span className="text-red-700">{note}</span>}
    </div>
  );
}
