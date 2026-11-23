import Link from "next/link";

const steps = [
  {
    title: "1. Kampus menerbitkan",
    body: "Staf mengunggah PDF ijazah. Sidik jari SHA-256-nya dicatat di blockchain, file disimpan di vault privat.",
  },
  {
    title: "2. Ijazah dibagikan",
    body: "Alumni menerima PDF dengan QR code yang mengarah ke halaman verifikasi.",
  },
  {
    title: "3. Siapa pun memverifikasi",
    body: "Unggah PDF atau scan QR. Perubahan sekecil apa pun pada file membuat hasilnya tidak valid.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-5 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
          Ijazah digital yang tidak bisa dipalsukan
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-600">
          Keaslian ijazah dicatat di blockchain dan bisa dicek siapa saja dalam hitungan detik, tanpa login.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/verify" className="btn-primary px-6 py-3 text-base">
            Verifikasi Ijazah
          </Link>
          <Link href="/issuer" className="btn-secondary px-6 py-3 text-base">
            Masuk sebagai Staf Kampus
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="card">
            <h2 className="mb-2 font-semibold text-brand-900">{s.title}</h2>
            <p className="text-sm text-slate-600">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
