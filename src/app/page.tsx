"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RollButton, RollLink } from "@/components/roll-button";
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
import { useFadeInUp } from "@/lib/animations";

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
    serialNumber: "DPL-2026-CS-001",
    studentId: "123200045",
    studentName: "Alexander Wright",
    issueDate: "2026-08-15",
    major: "Computer Science",
    university: "Pacific Institute of Technology",
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
      setError("All fields marked with an asterisk (*) are required.");
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
        throw new Error(data.error || "Failed to generate QR Code");
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
      setError(err instanceof Error ? err.message : "An unexpected system error occurred");
    } finally {
      setLoading(false);
    }
  }

  function handlePreset(preset: "cs" | "is" | "eng") {
    if (preset === "cs") {
      setFormData({
        serialNumber: "DPL-2026-CS-001",
        studentId: "123200045",
        studentName: "Alexander Wright",
        issueDate: "2026-08-15",
        major: "Computer Science",
        university: "Pacific Institute of Technology",
      });
    } else if (preset === "is") {
      setFormData({
        serialNumber: "DPL-2026-IS-002",
        studentId: "123200088",
        studentName: "Sarah Jenkins",
        issueDate: "2026-08-15",
        major: "Information Systems",
        university: "Metropolitan University",
      });
    } else {
      setFormData({
        serialNumber: `DPL-2026-ENG-${Math.floor(100 + Math.random() * 900)}`,
        studentId: `240${Math.floor(100000 + Math.random() * 900000)}`,
        studentName: "Marcus Vance",
        issueDate: "2026-09-01",
        major: "Computer Engineering",
        university: "Federal Polytechnic Institute",
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
    <div className="space-y-6 sm:space-y-8">
      {/* Simple Page Header */}
      <div ref={heroRef} className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-[var(--text-primary)]">
            Digital Diploma Vault &amp; QR Engine
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-xl leading-relaxed">
            Deterministic SHA-256 fingerprint computation from official academic records with instant verification QR code generation.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="opacity-60 text-xs mr-1 text-[var(--text-secondary)]">Quick Presets:</span>
          <RollButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handlePreset("cs")}
          >
            Computer Science
          </RollButton>
          <RollButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handlePreset("is")}
          >
            Information Systems
          </RollButton>
          <RollButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handlePreset("eng")}
          >
            Engineering
          </RollButton>
        </div>
      </div>

      {/* Unified Digital Diploma Workstation */}
      <div className="glass-panel rounded-2xl border overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-black/10 dark:divide-white/10">
          {/* Left Console: Parameter Form */}
          <div ref={formRef} className="lg:col-span-7 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl theme-badge">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Credential Metadata</h2>
                  <p className="text-xs text-[var(--text-muted)]">Input parameters for canonical SHA-256 computation</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-mono theme-badge">
                Issuer Console
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
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Hash className="w-3.5 h-3.5 opacity-70 text-[var(--text-secondary)]" />
                  Diploma Serial Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="e.g. DPL-2026-CS-001"
                  className="input font-mono text-sm"
                  required
                />
              </div>

              {/* Student ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Hash className="w-3.5 h-3.5 opacity-70 text-[var(--text-secondary)]" />
                  Student ID / Matriculation No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  placeholder="e.g. 123200045"
                  className="input font-mono text-sm"
                  required
                />
              </div>

              {/* Student Name */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <User className="w-3.5 h-3.5 opacity-70 text-[var(--text-secondary)]" />
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  placeholder="e.g. Alexander Wright"
                  className="input text-sm"
                  required
                />
              </div>

              {/* Issue Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Calendar className="w-3.5 h-3.5 opacity-70 text-[var(--text-secondary)]" />
                  Conferral Date <span className="text-rose-500">*</span>
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
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <GraduationCap className="w-3.5 h-3.5 opacity-70 text-[var(--text-secondary)]" />
                  Degree / Major Program
                </label>
                <input
                  type="text"
                  value={formData.major || ""}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  placeholder="e.g. Computer Science"
                  className="input text-sm"
                />
              </div>

              {/* University */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold opacity-80 uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Building className="w-3.5 h-3.5 opacity-70 text-[var(--text-secondary)]" />
                  Awarding Institution
                </label>
                <input
                  type="text"
                  value={formData.university || ""}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  placeholder="e.g. Pacific Institute of Technology"
                  className="input text-sm"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-black/10 dark:border-white/10">
              <RollButton
                type="button"
                disabled={loading}
                loading={loading}
                loadingText="Computing SHA-256..."
                icon={!loading ? <QrCode className="w-4 h-4" /> : undefined}
                onClick={() => handleGenerateOrRegenerate(false)}
                className="flex-1"
              >
                Generate QR Code
              </RollButton>

              <RollButton
                type="button"
                variant="secondary"
                disabled={loading}
                icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
                onClick={() => handleGenerateOrRegenerate(true)}
                title="Recalculate hash and refresh QR Code in memory"
              >
                Regenerate
              </RollButton>
            </div>
          </div>

          {/* Right Console: Live Specimen & QR Engine */}
          <div ref={previewRef} className="lg:col-span-5 p-6 sm:p-8 space-y-6 bg-black/[0.015] dark:bg-white/[0.015]">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-[var(--text-primary)]">Cryptographic Specimen</h3>
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
                      Target URL: /verify?serial=...&amp;hash=...
                    </span>
                  </div>
                </div>

                {/* Computed Hash Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                      <Hash className="w-3.5 h-3.5 opacity-70 text-[var(--text-secondary)]" />
                      Computed SHA-256 Hash
                    </span>
                    <RollButton
                      size="sm"
                      variant="secondary"
                      onClick={() => copyText(lastResult.hash, "hash")}
                      icon={copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copiedHash ? "Copied!" : "Copy Hash"}
                    </RollButton>
                  </div>
                  <div className="p-3 theme-code-block rounded-xl font-mono text-[11px] break-all leading-relaxed">
                    {lastResult.hash}
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="space-y-2.5 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <RollButton
                      size="sm"
                      variant="secondary"
                      onClick={downloadQRCode}
                      icon={<Download className="w-3.5 h-3.5" />}
                      className="w-full"
                    >
                      Download PNG
                    </RollButton>

                    <RollButton
                      size="sm"
                      variant="secondary"
                      onClick={() => copyText(lastResult.verifyUrl, "link")}
                      icon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      className="w-full"
                    >
                      {copiedLink ? "Copied!" : "Copy Link URL"}
                    </RollButton>
                  </div>

                  {/* Direct Link to Verification Page */}
                  <RollLink
                    href={`/verify?serial=${encodeURIComponent(lastResult.serialNumber)}&hash=${lastResult.hash}`}
                    variant="emerald"
                    icon={<ShieldCheck className="w-4 h-4" />}
                    iconAfter={<ExternalLink className="w-3.5 h-3.5 ml-auto opacity-75" />}
                    className="w-full"
                  >
                    Open Verification (Valid)
                  </RollLink>

                  {/* Tampered Simulation Link (demonstrating Red Badge!) */}
                  <RollLink
                    href={`/verify?serial=${encodeURIComponent(lastResult.serialNumber)}&hash=${lastResult.hash.slice(0, -4)}dead`}
                    variant="rose"
                    className="w-full"
                    title="Simulate record tampering by altering the final 4 hash characters"
                  >
                    Simulate Tampering (Test Red Badge)
                  </RollLink>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center opacity-70 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl theme-badge flex items-center justify-center">
                  <QrCode className="w-8 h-8 opacity-60 text-[var(--text-secondary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">No QR Code Generated Yet</p>
                  <p className="text-xs opacity-70 mt-1 max-w-xs mx-auto text-[var(--text-secondary)]">
                    Click <strong>Generate QR Code</strong> in the left console to compute a cryptographic specimen.
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
            <div className="p-2.5 rounded-xl theme-badge">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Stored Credential Registry (In-Memory Store)</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Active credential records verifiable via the <code className="theme-code-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold">/api/verify</code> endpoint
              </p>
            </div>
          </div>

          <RollButton
            onClick={fetchStoredDiplomas}
            disabled={loadingList}
            size="sm"
            variant="secondary"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />}
          >
            Reload Registry
          </RollButton>
        </div>

        {/* Table of stored diplomas */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs theme-table">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 opacity-70 font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="py-3 px-3">Serial No.</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Student ID</th>
                <th className="py-3 px-3">Conferral Date</th>
                <th className="py-3 px-3">SHA-256 Hash</th>
                <th className="py-3 px-3 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-table-divide font-mono">
              {storedList.length > 0 ? (
                storedList.map((item) => (
                  <tr key={item.serialNumber} className="transition font-sans">
                    <td className="py-3.5 px-3 font-mono font-bold text-[var(--text-primary)]">
                      {item.serialNumber}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[var(--text-primary)]">{item.studentName}</td>
                    <td className="py-3.5 px-3 font-mono opacity-80 text-[var(--text-secondary)]">{item.studentId}</td>
                    <td className="py-3.5 px-3 opacity-70 text-[var(--text-secondary)]">{item.issueDate}</td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-[11px] theme-code-block px-2 py-1 rounded" title={item.hash}>
                        {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right space-x-2">
                      <RollButton
                        size="sm"
                        variant="secondary"
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
                      >
                        Load QR
                      </RollButton>

                      <RollLink
                        size="sm"
                        variant="emerald"
                        href={`/verify?serial=${encodeURIComponent(item.serialNumber)}&hash=${item.hash}`}
                        icon={<ShieldCheck className="w-3.5 h-3.5" />}
                      >
                        Verify
                      </RollLink>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center opacity-60 font-sans text-[var(--text-muted)]">
                    No credential records stored yet.
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
