"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  QrCode,
  ShieldCheck,
  RefreshCw,
  Hash,
  Download,
  Copy,
  Check,
  ExternalLink,
  GraduationCap,
  Database,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Building,
} from "lucide-react";
import { useFadeInUp, useStaggerFadeIn } from "@/lib/animations";

interface DiplomaData {
  serialNumber: string;
  studentId: string;
  studentName: string;
  issueDate: string;
  major?: string;
  university?: string;
}

interface StoredDiploma extends DiplomaData {
  hash: string;
  qrCodeUrl?: string;
  verifyUrl?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export default function DashboardPage() {
  // Form State
  const [formData, setFormData] = useState<DiplomaData>({
    serialNumber: "IJZ-2026-CS-001",
    studentId: "123200045",
    studentName: "Budi Santoso",
    issueDate: "2026-08-15",
    major: "Teknik Informatika",
    university: "Universitas Sains & Teknologi Indonesia",
  });

  // Action / Response State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    serialNumber: string;
    hash: string;
    qrCodeUrl: string;
    verifyUrl: string;
  } | null>(null);

  // Stored Diplomas list
  const [storedList, setStoredList] = useState<StoredDiploma[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Copy status
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Anime.js animation refs
  const heroRef = useFadeInUp<HTMLDivElement>({ duration: 900 });
  const formRef = useFadeInUp<HTMLDivElement>({ delay: 150, duration: 800 });
  const previewRef = useFadeInUp<HTMLDivElement>({ delay: 300, duration: 800 });
  const tableRef = useFadeInUp<HTMLDivElement>({ delay: 200, duration: 800 });

  // Fetch initial stored list
  useEffect(() => {
    fetchStoredDiplomas();
  }, []);

  async function fetchStoredDiplomas() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/qr");
      const data = await res.json();
      if (data.success && data.diplomas) {
        setStoredList(data.diplomas);
      }
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }

  async function handleGenerateOrRegenerate(isRegenerate: boolean = false) {
    if (!formData.serialNumber || !formData.studentId || !formData.studentName || !formData.issueDate) {
      setError("Semua bidang bertanda bintang (*) wajib diisi.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghasilkan QR Code");
      }

      setLastResult({
        serialNumber: data.serialNumber,
        hash: data.hash,
        qrCodeUrl: data.qrCodeUrl,
        verifyUrl: data.verifyUrl,
      });

      // Refresh stored list
      fetchStoredDiplomas();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  function handlePreset(preset: "cs" | "is" | "med") {
    if (preset === "cs") {
      setFormData({
        serialNumber: "IJZ-2026-CS-001",
        studentId: "123200045",
        studentName: "Budi Santoso",
        issueDate: "2026-08-15",
        major: "Teknik Informatika",
        university: "Universitas Sains & Teknologi Indonesia",
      });
    } else if (preset === "is") {
      setFormData({
        serialNumber: "IJZ-2026-IS-002",
        studentId: "123200088",
        studentName: "Siti Rahmawati",
        issueDate: "2026-08-15",
        major: "Sistem Informasi",
        university: "Universitas Sains & Teknologi Indonesia",
      });
    } else {
      setFormData({
        serialNumber: `IJZ-2026-ENG-${Math.floor(100 + Math.random() * 900)}`,
        studentId: `240${Math.floor(100000 + Math.random() * 900000)}`,
        studentName: "Ahmad Dahlan",
        issueDate: "2026-09-01",
        major: "Teknik Komputer & Jaringan",
        university: "Institut Teknologi & Bisnis Digital",
      });
    }
  }

  function copyText(text: string, type: "hash" | "link") {
    navigator.clipboard.writeText(text);
    if (type === "hash") {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  function downloadQRCode() {
    if (!lastResult?.qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = lastResult.qrCodeUrl;
    link.download = `QR-${lastResult.serialNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-10">
      {/* Hero Banner */}
      <div ref={heroRef} className="theme-hero rounded-2xl p-8 sm:p-10 shadow-sm relative overflow-hidden border border-black/10 dark:border-white/10">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-serif">
            Digital Diploma Vault & QR Code Engine
          </h1>
          <p className="opacity-80 text-sm sm:text-base leading-relaxed">
            Menghasilkan sidik jari kriptografis <strong>SHA-256 deterministik</strong> dari data ijazah resmi, memproduksi QR Code dinamis beresolusi tinggi, dan menyediakan portal verifikasi integritas publik secara instan.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <span className="text-xs opacity-70 font-medium">Contoh Data Cepat:</span>
            <button
              type="button"
              onClick={() => handlePreset("cs")}
              className="btn btn-sm btn-secondary"
            >
              Informatika (Budi)
            </button>
            <button
              type="button"
              onClick={() => handlePreset("is")}
              className="btn btn-sm btn-secondary"
            >
              Sist. Informasi (Siti)
            </button>
            <button
              type="button"
              onClick={() => handlePreset("med")}
              className="btn btn-sm btn-secondary"
            >
              Kedokteran (Rian)
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Form (Left) & QR Code Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Section (7 cols) in Card / Card2 */}
        <div ref={formRef} className="lg:col-span-7 card">
          <div className="card2 glass-panel p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Metadata Ijazah</h2>
                  <p className="text-xs opacity-70">Parameter untuk perhitungan SHA-256 deterministik</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-mono theme-badge">
                Form Penerbit
              </span>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Serial Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-blue-500" />
                  Nomor Seri Ijazah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="mis. IJZ-2026-CS-001"
                  className="input font-mono text-sm"
                  required
                />
              </div>

              {/* Student ID / NIM */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-500" />
                  NIM / Student ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  placeholder="mis. 123200045"
                  className="input font-mono text-sm"
                  required
                />
              </div>

              {/* Student Name */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  Nama Lengkap Mahasiswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  placeholder="mis. Budi Santoso"
                  className="input text-sm"
                  required
                />
              </div>

              {/* Issue Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Tanggal Penerbitan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="input text-sm"
                  required
                />
              </div>

              {/* Major */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                  Program Studi
                </label>
                <input
                  type="text"
                  value={formData.major || ""}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  placeholder="mis. Teknik Informatika"
                  className="input text-sm"
                />
              </div>

              {/* University */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-purple-500" />
                  Institusi Penerbit
                </label>
                <input
                  type="text"
                  value={formData.university || ""}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  placeholder="mis. Universitas Sains & Teknologi Indonesia"
                  className="input text-sm"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleGenerateOrRegenerate(false)}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses SHA-256...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Generate QR Code</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleGenerateOrRegenerate(true)}
                className="btn btn-secondary"
                title="Kalkulasi ulang hash dan perbarui QR Code di memori"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Section (5 cols) in Card / Card2 */}
        <div ref={previewRef} className="lg:col-span-5 card">
          <div className="card2 glass-panel p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base">Live Preview QR & Hash</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-mono font-semibold">
                512px High-Res
              </span>
            </div>

            {lastResult ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                {/* QR Code Container (Sharp white card for maximum optical readability) */}
                <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-white rounded-2xl shadow-xl border border-black/5 relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lastResult.qrCodeUrl}
                    alt={`QR Code ${lastResult.serialNumber}`}
                    width={224}
                    height={224}
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                  <div className="mt-3 text-center">
                    <span className="text-[11px] font-mono text-slate-600 block">
                      Target URL: /verify?serial=...&hash=...
                    </span>
                  </div>
                </div>

                {/* Computed Hash Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-blue-500" />
                      Computed SHA-256 Hash
                    </span>
                    <button
                      onClick={() => copyText(lastResult.hash, "hash")}
                      className="btn btn-sm btn-secondary"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedHash ? "Tersalin!" : "Salin Hash"}
                    </button>
                  </div>
                  <div className="p-3 theme-code-block rounded-xl font-mono text-[11px] break-all leading-relaxed">
                    {lastResult.hash}
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="space-y-2.5 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={downloadQRCode}
                      className="btn btn-sm btn-secondary w-full"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh PNG
                    </button>

                    <button
                      onClick={() => copyText(lastResult.verifyUrl, "link")}
                      className="btn btn-sm btn-secondary w-full"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      Salin Link URL
                    </button>
                  </div>

                  {/* Direct Link to Verification Page */}
                  <Link
                    href={`/verify?serial=${encodeURIComponent(lastResult.serialNumber)}&hash=${lastResult.hash}`}
                    className="btn btn-emerald w-full"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Uji Halaman Verifikasi (Valid)</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-75" />
                  </Link>

                  {/* Tampered Simulation Link (demonstrating Red Badge!) */}
                  <Link
                    href={`/verify?serial=${encodeURIComponent(lastResult.serialNumber)}&hash=${lastResult.hash.slice(0, -4)}dead`}
                    className="btn btn-rose w-full"
                    title="Simulasikan pemalsuan data dengan mengubah 4 digit terakhir hash"
                  >
                    <span>Simulasi Pemalsuan (Cek Red Badge)</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center opacity-70 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl theme-badge flex items-center justify-center">
                  <QrCode className="w-8 h-8 opacity-60" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Belum Ada QR Code Dihasilkan</p>
                  <p className="text-xs opacity-70 mt-1 max-w-xs mx-auto">
                    Klik tombol <strong>Generate QR Code</strong> di formulir sebelah kiri untuk melihat pratinjau langsung.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Database Store List (Mock Store Explorer) */}
      <div ref={tableRef} className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Repositori Ijazah Tersimpan (In-Memory Store)</h2>
                <p className="text-xs opacity-70">
                  Data aktif yang dapat diverifikasi melalui API <code className="text-blue-500 font-mono">/api/verify</code>
                </p>
              </div>
            </div>

            <button
              onClick={fetchStoredDiplomas}
              disabled={loadingList}
              className="btn btn-sm btn-secondary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />
              <span>Muat Ulang Data</span>
            </button>
          </div>

          {/* Table of stored diplomas */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs theme-table">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 opacity-70 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Nomor Seri</th>
                  <th className="py-3 px-3">Nama Mahasiswa</th>
                  <th className="py-3 px-3">NIM</th>
                  <th className="py-3 px-3">Tanggal Terbit</th>
                  <th className="py-3 px-3">SHA-256 Hash</th>
                  <th className="py-3 px-3 text-right">Aksi Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y theme-table-divide font-mono">
                {storedList.length > 0 ? (
                  storedList.map((item) => (
                    <tr key={item.serialNumber} className="transition font-sans">
                      <td className="py-3.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.serialNumber}
                      </td>
                      <td className="py-3.5 px-3 font-semibold">{item.studentName}</td>
                      <td className="py-3.5 px-3 font-mono opacity-80">{item.studentId}</td>
                      <td className="py-3.5 px-3 opacity-70">{item.issueDate}</td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] theme-code-block px-2 py-1 rounded" title={item.hash}>
                          {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setFormData({
                              serialNumber: item.serialNumber,
                              studentId: item.studentId,
                              studentName: item.studentName,
                              issueDate: item.issueDate,
                              major: item.major,
                              university: item.university,
                            });
                            handleGenerateOrRegenerate(true);
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          Buka QR
                        </button>

                        <Link
                          href={`/verify?serial=${encodeURIComponent(item.serialNumber)}&hash=${item.hash}`}
                          className="btn btn-sm btn-emerald"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verifikasi
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center opacity-60 font-sans">
                      Tidak ada rekaman ijazah.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
