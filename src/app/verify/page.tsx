"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RollButton } from "@/components/roll-button";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ArrowLeft,
  Building,
  User,
  Hash,
  Calendar,
  GraduationCap,
  RefreshCw,
  Info,
} from "lucide-react";

interface VerificationResult {
  success: boolean;
  status: "valid" | "invalid" | "not_found";
  message: string;
  serialNumber?: string;
  inputHash?: string;
  storedHash?: string;
  isIntegrityIntact?: boolean;
  diploma?: {
    serialNumber: string;
    studentId: string;
    studentName: string;
    issueDate: string;
    major?: string;
    university?: string;
    createdAt: string;
    updatedAt: string;
  };
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const querySerial = searchParams.get("serial") || "";
  const queryHash = searchParams.get("hash") || "";

  const [serialInput, setSerialInput] = useState(querySerial);
  const [hashInput, setHashInput] = useState(queryHash);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-verify when URL parameters are present
  useEffect(() => {
    if (querySerial) {
      setSerialInput(querySerial);
      setHashInput(queryHash);
      performVerification(querySerial, queryHash);
    }
  }, [querySerial, queryHash]);

  async function performVerification(serial: string, hashToVerify: string) {
    if (!serial.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL("/api/verify", window.location.origin);
      url.searchParams.set("serial", serial.trim());
      if (hashToVerify.trim()) {
        url.searchParams.set("hash", hashToVerify.trim());
      }

      const res = await fetch(url.toString());
      const data: VerificationResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi dokumen");
    } finally {
      setLoading(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serialInput.trim()) return;

    // Update browser URL query params
    const params = new URLSearchParams();
    params.set("serial", serialInput.trim());
    if (hashInput.trim()) params.set("hash", hashInput.trim());
    router.push(`/verify?${params.toString()}`);

    performVerification(serialInput, hashInput);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Dashboard Penerbitan
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            Portal Verifikasi Publik Ijazah
          </h1>
          <p className="opacity-75 text-sm mt-1">
            Validasi keaslian dokumen secara instan melalui pemeriksaan integritas kriptografis SHA-256.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-mono theme-badge">
            Read-Only Engine
          </span>
        </div>
      </div>

      {/* Manual Search Form */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold opacity-80 uppercase tracking-wider mb-2">
                Nomor Seri Ijazah <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="mis. IJZ-2026-CS-001"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                className="input font-mono text-sm"
                required
              />
            </div>

            <div className="md:col-span-8">
              <label className="block text-xs font-semibold opacity-80 uppercase tracking-wider mb-2">
                Sidik Jari Hash SHA-256 (Opsional / Dari QR Code)
              </label>
              <input
                type="text"
                placeholder="64-karakter hex hash..."
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                className="input font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs opacity-75 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Petunjuk: Kosongkan field hash untuk memeriksa status nomor seri di basis data.</span>
            </div>

            <RollButton
              type="submit"
              disabled={loading || !serialInput.trim()}
              loading={loading}
              loadingText="Memeriksa Integritas..."
              icon={!loading ? <Search className="w-4 h-4" /> : undefined}
            >
              Verifikasi Ijazah
            </RollButton>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Verification Result Display */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Main Status Badge */}
          {result.status === "valid" ? (
            <div className="rounded-2xl p-6 sm:p-8 border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold tracking-wider uppercase mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      IJAZAH ASLI & TERVERIFIKASI
                    </div>
                    <h2 className="text-xl font-bold font-serif">Integritas Dokumen Terbukti Sah</h2>
                    <p className="opacity-80 text-xs sm:text-sm mt-0.5">
                      {result.message}
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-xs opacity-70 block">Metode Validasi</span>
                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    SHA-256 Hash Matching
                  </span>
                </div>
              </div>
            </div>
          ) : result.status === "invalid" ? (
            <div className="rounded-2xl p-6 sm:p-8 border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs font-bold tracking-wider uppercase mb-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      DATA TIDAK COCOK / TELAH DIMODIFIKASI
                    </div>
                    <h2 className="text-xl font-bold font-serif">Peringatan: Potensi Pemalsuan Dokumen</h2>
                    <p className="opacity-80 text-xs sm:text-sm mt-0.5">
                      {result.message}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 sm:p-8 border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold tracking-wider uppercase mb-1">
                    NOMOR SERI TIDAK DITEMUKAN
                  </div>
                  <h2 className="text-xl font-bold font-serif">Data Ijazah Tidak Terdaftar</h2>
                  <p className="opacity-80 text-xs sm:text-sm mt-0.5">
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Official Verification Ledger & Cryptographic Audit */}
          <div className="glass-panel rounded-2xl border p-6 sm:p-8 space-y-8 shadow-sm">
            {/* Header Record */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-serif">Metadata Resmi Ijazah</h3>
                  <p className="text-xs opacity-70">Data terdaftar secara sah dalam repositori verifikasi</p>
                </div>
              </div>
              {result.diploma?.serialNumber && (
                <div className="text-left sm:text-right">
                  <span className="text-[11px] opacity-60 block uppercase font-mono">No. Seri Resmi</span>
                  <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                    {result.diploma.serialNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Official Credential Definition List (Clean Linear Ledger - No Bento Grid) */}
            {result.diploma && (
              <dl className="divide-y divide-black/10 dark:divide-white/10 text-sm">
                <div className="py-3.5 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
                  <dt className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    Nama Lengkap Mahasiswa
                  </dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 font-bold text-base">
                    {result.diploma.studentName}
                  </dd>
                </div>

                <div className="py-3.5 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
                  <dt className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-500" />
                    NIM / Student ID
                  </dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 font-mono font-semibold">
                    {result.diploma.studentId}
                  </dd>
                </div>

                <div className="py-3.5 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
                  <dt className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                    Program Studi
                  </dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 font-medium">
                    {result.diploma.major || "Program Sarjana"}
                  </dd>
                </div>

                <div className="py-3.5 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
                  <dt className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-purple-500" />
                    Institusi Penerbit
                  </dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 font-medium">
                    {result.diploma.university || "Universitas Terakreditasi Resmi"}
                  </dd>
                </div>

                <div className="py-3.5 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
                  <dt className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    Tanggal Penerbitan
                  </dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 font-medium">
                    {result.diploma.issueDate}
                  </dd>
                </div>
              </dl>
            )}

            {/* Cryptographic Proof Section */}
            <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-4">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  Audit Integritas Kriptografis (SHA-256)
                </h4>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Input Hash */}
                <div className="p-3.5 rounded-xl theme-code-block">
                  <div className="flex items-center justify-between opacity-80 mb-1">
                    <span className="font-sans font-medium text-xs">Hash yang Disertakan (Input / QR Code):</span>
                    {result.inputHash && (
                      <RollButton
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(result.inputHash || "")}
                        icon={copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      >
                        Salin
                      </RollButton>
                    )}
                  </div>
                  <p className="break-all font-semibold">
                    {result.inputHash || (
                      <span className="opacity-60 italic font-sans">
                        (Tidak disertakan dalam permintaan verifikasi)
                      </span>
                    )}
                  </p>
                </div>

                {/* Stored Hash */}
                <div className="p-3.5 rounded-xl theme-code-block">
                  <div className="flex items-center justify-between opacity-80 mb-1">
                    <span className="font-sans font-medium text-xs">Hash Resmi Terkalkulasi (Store Rekaman):</span>
                    {result.storedHash && (
                      <RollButton
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(result.storedHash || "")}
                        icon={copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      >
                        Salin
                      </RollButton>
                    )}
                  </div>
                  <p className="break-all font-semibold">
                    {result.storedHash || (
                      <span className="opacity-60 italic font-sans">(Tidak ada rekaman tersimpan)</span>
                    )}
                  </p>
                </div>

                {/* Match Result Indicator */}
                <div className="flex items-center justify-between p-3 rounded-xl theme-card text-xs">
                  <span className="font-sans opacity-80">Status Pencocokan Bit-by-Bit:</span>
                  {result.status === "valid" ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-sans font-semibold inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> 100% Identik (Integritas Asli)
                    </span>
                  ) : result.status === "invalid" ? (
                    <span className="text-rose-700 dark:text-rose-400 font-sans font-semibold inline-flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Tidak Cocok (Terdeteksi Modifikasi)
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400 font-sans font-semibold">
                      Tidak Dapat Dibandingkan
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Instructions */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-6 text-sm space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Cara Kerja Verifikasi Kriptografis
          </h3>
          <p className="opacity-80 leading-relaxed">
            Sistem ini menggunakan algoritma hash deterministik <strong>SHA-256</strong>. Setiap ijazah yang diterbitkan memiliki sidik jari unik 256-bit (64 karakter heksadesimal) yang dihitung dari kombinasi nomor seri, NIM, nama mahasiswa, dan tanggal penerbitan.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs opacity-75">
            <li>Jika salah satu huruf atau angka diubah (misal nama atau tanggal), sidik jari SHA-256 akan berubah secara total (*avalanche effect*).</li>
            <li>Pemindai QR code pada dokumen fisik akan secara otomatis mengarahkan ke halaman ini beserta hash untuk verifikasi silang otomatis.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-16 text-center opacity-70">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm">Memuat Portal Verifikasi Ijazah...</p>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
