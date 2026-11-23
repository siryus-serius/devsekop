"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DiplomaActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function call(action: "sync" | "revoke") {
    if (action === "revoke" && !confirm("Ajukan pencabutan ijazah ini? Tindakan ini tercatat permanen di blockchain.")) {
      return;
    }
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/issuer/diplomas/${id}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNote(body.error ?? "Gagal.");
    if (action === "revoke" && !body.executed) setNote(`Proposal pencabutan #${body.proposalId} menunggu persetujuan.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-secondary px-3 py-1 text-xs" onClick={() => call("sync")} disabled={busy}>
        Sinkron status
      </button>
      {status === "issued" && (
        <button className="btn-danger px-3 py-1 text-xs" onClick={() => call("revoke")} disabled={busy}>
          Cabut
        </button>
      )}
      {note && <span className="text-xs text-slate-600">{note}</span>}
    </div>
  );
}
