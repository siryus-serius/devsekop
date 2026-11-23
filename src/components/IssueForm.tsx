"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Issued = { txHash: string; explorerUrl: string | null; verifyUrl: string; qr: string };

export function IssueForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssued(null);
    const res = await fetch("/api/issuer/diplomas", { method: "POST", body: new FormData(e.currentTarget) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Penerbitan gagal.");
    setIssued(body as Issued);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card grid gap-4 sm:grid-cols-2">
      <h2 className="text-lg font-semibold text-brand-900 sm:col-span-2">Terbitkan Ijazah</h2>
      <Field name="serialNumber" label="Nomor seri" placeholder="DEMO-2026-0001" required />
      <Field name="studentNumber" label="NIM" placeholder="2201001" required />
      <Field name="studentName" label="Nama mahasiswa" required />
      <Field name="program" label="Program studi" placeholder="S1 Informatika" required />
      <Field name="graduationDate" label="Tanggal lulus" type="date" required />
      <div>
        <label className="label" htmlFor="file">
          File PDF ijazah
        </label>
        <input id="file" name="file" type="file" accept="application/pdf" className="input" required />
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      {issued && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 sm:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={issued.qr} alt="QR verifikasi" width={120} height={120} />
          <div className="min-w-0 space-y-1 break-all">
            <p className="font-semibold">Ijazah tercatat di blockchain.</p>
            <p>
              Tx:{" "}
              {issued.explorerUrl ? (
                <a href={issued.explorerUrl} target="_blank" rel="noreferrer" className="underline">
                  {issued.txHash}
                </a>
              ) : (
                issued.txHash
              )}
            </p>
            <p>
              Link verifikasi: <a href={issued.verifyUrl} className="underline">{issued.verifyUrl}</a>
            </p>
          </div>
        </div>
      )}

      <div className="sm:col-span-2">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Memproses (validasi → hash → blockchain)…" : "Terbitkan"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}
