"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Stage =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "challenge"; factorId: string }
  | { kind: "error"; message: string };

/** MFA TOTP wajib (REQ-03): pendaftaran faktor pertama kali, lalu tantangan setiap login. */
function MfaFlow() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        router.replace(next);
        return;
      }
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setStage({ kind: "error", message: "Sesi tidak valid. Silakan masuk kembali." });

      const verified = factors.totp.find((f) => f.status === "verified");
      if (verified) return setStage({ kind: "challenge", factorId: verified.id });

      // Bersihkan faktor yang belum selesai didaftarkan sebelum membuat yang baru.
      for (const f of factors.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Vault Ijazah ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError || !data) return setStage({ kind: "error", message: "Gagal memulai pendaftaran MFA." });
      setStage({ kind: "enroll", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [next, router]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (stage.kind !== "enroll" && stage.kind !== "challenge") return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: stage.factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setError("Kode tidak valid atau kedaluwarsa.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4">
        <h1 className="text-2xl font-bold text-brand-900">Verifikasi Dua Langkah</h1>
        {stage.kind === "loading" && <p className="text-sm text-slate-600">Memuat…</p>}
        {stage.kind === "error" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{stage.message}</p>}
        {stage.kind === "enroll" && (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Pindai QR code berikut dengan aplikasi autentikator (Google Authenticator, Authy, 1Password, dll.).</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stage.qr} alt="QR code pendaftaran MFA" className="mx-auto h-48 w-48 rounded-lg border bg-white p-2" />
            <p className="text-xs text-slate-500">
              Tidak bisa memindai? Masukkan kunci ini secara manual:{" "}
              <code className="font-mono break-all">{stage.secret}</code>
            </p>
          </div>
        )}
        {(stage.kind === "enroll" || stage.kind === "challenge") && (
          <form onSubmit={verify} className="space-y-3">
            <label className="label" htmlFor="code">
              Kode 6 digit
            </label>
            <input
              id="code"
              className="input text-center font-mono text-lg tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
              {busy ? "Memverifikasi…" : "Verifikasi"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <MfaFlow />
    </Suspense>
  );
}
