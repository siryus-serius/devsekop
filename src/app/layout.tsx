import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Shield, QrCode, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Vault Ijazah Digital | QR & SHA-256 Engine",
  description:
    "Platform Verifikasi dan Pembuatan QR Code Ijazah Digital Berbasis Deterministic SHA-256 Hashing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="dark">
      <head>
        {/* Anti-FOUC inline script to immediately set theme class */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('diploma_vault_theme');
                  if (saved === 'light' || (!saved && window.matchMedia('(prefers-color-scheme: light)').matches)) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased selection:bg-blue-600 selection:text-white flex flex-col min-h-screen">
        {/* Subtle Ambient Background Lighting */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 ambient-glow-1 rounded-full blur-3xl transition-colors duration-500"></div>
          <div className="absolute top-1/3 -right-40 w-96 h-96 ambient-glow-2 rounded-full blur-3xl transition-colors duration-500"></div>
          <div className="absolute -bottom-40 left-1/3 w-96 h-96 ambient-glow-3 rounded-full blur-3xl transition-colors duration-500"></div>
        </div>

        {/* Global Navigation Header */}
        <header className="sticky top-0 z-50 glass-panel border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight">
                  Vault Ijazah Digital
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold theme-badge">
                  Phase-1
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <QrCode className="w-4 h-4 text-blue-500" />
                <span className="hidden sm:inline">Dashboard & QR</span>
              </Link>

              <Link
                href="/verify"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="hidden sm:inline">Verifikasi Publik</span>
              </Link>

              {/* Theme Toggle Button */}
              <div className="pl-1 border-l border-black/10 dark:border-white/10">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </header>

        {/* Main Application Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="glass-panel border-t py-6 text-center text-xs opacity-70">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>
              © {new Date().getFullYear()} Digital Diploma Vault • DevSecOps Phase-1 Implementation
            </p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                SHA-256 Engine Active
              </span>
              <span>•</span>
              <span>In-Memory Store</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
