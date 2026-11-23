"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        // Pesan generik: tidak membocorkan apakah email terdaftar (mitigasi user enumeration).
        if (error) throw new Error("Email atau kata sandi salah.");
        router.push(`/mfa?next=${encodeURIComponent(next)}`);
        router.refresh();
      } else {
        if (password.length < 12) throw new Error("Kata sandi minimal 12 karakter.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw new Error("Pendaftaran gagal. Periksa data Anda.");
        setMessage({ type: "info", text: "Periksa email Anda untuk konfirmasi akun, lalu masuk." });
        setMode("signin");
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Terjadi kesalahan." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={onSubmit} className="card space-y-4">
        <h1 className="text-2xl font-bold text-brand-900">{mode === "signin" ? "Masuk" : "Daftar Akun Alumni"}</h1>
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="fullName">
              Nama lengkap
            </label>
            <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Kata sandi
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === "signup" ? 12 : undefined}
            required
          />
        </div>
        {message && (
          <p className={`rounded-lg p-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-900"}`}>
            {message.text}
          </p>
        )}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Memproses…" : mode === "signin" ? "Masuk" : "Daftar"}
        </button>
        <button
          type="button"
          className="w-full text-sm text-brand-700 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
        <p className="text-xs text-slate-500">Setelah masuk, Anda wajib memverifikasi kode autentikator (MFA).</p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
