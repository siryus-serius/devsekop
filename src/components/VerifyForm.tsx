"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VerificationResult as Result } from "@/lib/chain/registry";
import { VerificationResult } from "./VerificationResult";

async function sha256OfFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function VerifyForm() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serial, setSerial] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Pilih file PDF.");
      return;
    }
    setLoading(true);
    try {
      // Hash dihitung di browser; file tidak pernah diunggah ke server.
      const h = await sha256OfFile(file);
      setHash(h);
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: h }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Verifikasi gagal.");
      setResult(body as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verifikasi gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed text-center hover:border-brand-600">
          <span className="text-4xl" aria-hidden>
            📄
          </span>
          <span className="font-semibold text-brand-900">Unggah PDF ijazah</span>
          <span className="text-xs text-slate-500">
            Hash SHA-256 dihitung di perangkat Anda. Dokumen tidak dikirim ke server.
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={loading}
          />
        </label>

        <form
          className="card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const s = serial.trim();
            if (s) router.push(`/verify/${encodeURIComponent(s)}`);
          }}
        >
          <label className="label" htmlFor="serial">
            Atau masukkan nomor seri ijazah
          </label>
          <input
            id="serial"
            className="input"
            placeholder="mis. UNIV-DEMO-2026-000123"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            maxLength={64}
          />
          <button className="btn-primary w-full" type="submit">
            Periksa Nomor Seri
          </button>
          <p className="text-xs text-slate-500">QR code pada ijazah mengarah langsung ke halaman verifikasi.</p>
        </form>
      </div>

      {loading && <p className="text-sm text-slate-600">Menghitung hash dan memeriksa blockchain…</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {hash && !loading && <p className="font-mono text-xs break-all text-slate-500">SHA-256: {hash}</p>}
      {result && <VerificationResult result={result} />}
    </div>
  );
}
