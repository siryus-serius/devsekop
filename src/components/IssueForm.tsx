"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function IssueForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/issuer/diplomas", { method: "POST", body: new FormData(e.currentTarget) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage({ type: "error", text: body.error ?? "Penerbitan gagal." });

    setMessage({
      type: "ok",
      text:
        body.status === "issued"
          ? `Ijazah terbit on-chain. Tx: ${body.txHash}`
          : `Proposal #${body.proposalId} dibuat. Menunggu persetujuan approver lain (multi-sig).`,
    });
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card grid gap-4 sm:grid-cols-2">
      <h2 className="text-lg font-semibold text-brand-900 sm:col-span-2">Terbitkan Ijazah Baru</h2>
      <Field name="serialNumber" label="Nomor seri" placeholder="UNIV-DEMO-2026-000123" required />
      <Field name="holderEmail" label="Email alumni" type="email" required />
      <Field name="holderName" label="Nama lengkap" required />
      <Field name="program" label="Program studi" required />
      <Field name="graduationDate" label="Tanggal lulus" type="date" required />
      <Field name="nik" label="NIK (opsional, dienkripsi)" inputMode="numeric" pattern="\d{16}" />
      <Field name="gpa" label="IPK (opsional, dienkripsi)" placeholder="3.75" />
      <div>
        <label className="label" htmlFor="file">
          File PDF final (sudah berisi QR & nomor seri)
        </label>
        <input id="file" name="file" type="file" accept="application/pdf" className="input" required />
      </div>
      {message && (
        <p
          className={`rounded-lg p-3 text-sm break-all sm:col-span-2 ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {message.text}
        </p>
      )}
      <div className="sm:col-span-2">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Memproses (validasi → enkripsi → tanda tangan → blockchain)…" : "Terbitkan"}
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
