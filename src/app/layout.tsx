import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Vault Ijazah Digital", template: "%s | Vault Ijazah Digital" },
  description:
    "Penerbitan dan verifikasi publik ijazah digital berbasis blockchain. Verifikasi keaslian ijazah secara instan tanpa login.",
  openGraph: { type: "website", locale: "id_ID", siteName: "Vault Ijazah Digital" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Membaca header membuat halaman dirender dinamis sehingga nonce CSP diterapkan per request.
  await headers();
  return (
    <html lang="id">
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          Vault Ijazah Digital — hash dokumen tercatat di blockchain, data pribadi tetap off-chain.
        </footer>
      </body>
    </html>
  );
}
