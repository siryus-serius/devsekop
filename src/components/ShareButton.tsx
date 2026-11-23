"use client";

import { useState } from "react";

type Share = { url: string; qrDataUrl: string; expiresAt: string };

export function ShareButton({ diplomaId }: { diplomaId: string }) {
  const [days, setDays] = useState(30);
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/vault/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diplomaId, expiresInDays: days }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Gagal membuat tautan.");
    setShare(body as Share);
  }

  if (share) {
    return (
      <div className="mt-4 space-y-3 rounded-xl bg-brand-50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={share.qrDataUrl} alt="QR code tautan verifikasi" className="h-40 w-40 rounded-lg bg-white p-2" />
        <div className="flex gap-2">
          <input readOnly className="input font-mono text-xs" value={share.url} aria-label="Tautan berbagi" />
          <button
            className="btn-secondary shrink-0"
            onClick={async () => {
              await navigator.clipboard.writeText(share.url);
              setCopied(true);
            }}
          >
            {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Berlaku hingga {new Date(share.expiresAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}.
          Tautan ini hanya ditampilkan sekali — simpan sekarang.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="input w-auto"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        aria-label="Masa berlaku tautan"
      >
        <option value={7}>7 hari</option>
        <option value={30}>30 hari</option>
        <option value={90}>90 hari</option>
      </select>
      <button className="btn-secondary" onClick={create} disabled={busy}>
        {busy ? "Membuat…" : "Bagikan / QR"}
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
