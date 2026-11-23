import type { Metadata } from "next";
import { VerifyForm } from "@/components/VerifyForm";

export const metadata: Metadata = {
  title: "Verifikasi Keaslian Ijazah",
  description:
    "Verifikasi keaslian ijazah digital secara instan dan gratis. Unggah PDF atau masukkan nomor seri — dicocokkan dengan catatan blockchain yang tidak dapat diubah.",
  alternates: { canonical: "/verify" },
};

export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand-900">Verifikasi Ijazah</h1>
        <p className="text-slate-600">
          Untuk pemberi kerja, institusi, dan publik. Tidak perlu login. Setiap perubahan sekecil apa pun pada PDF akan
          menghasilkan hash berbeda dan terdeteksi sebagai tidak valid.
        </p>
      </header>
      <VerifyForm />
    </div>
  );
}
