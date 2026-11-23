import Link from "next/link";

const features = [
  {
    title: "Verifikasi instan tanpa login",
    body: "Unggah PDF atau pindai QR code. Hash SHA-256 dicocokkan langsung dengan catatan di blockchain.",
  },
  {
    title: "Data pribadi tetap off-chain",
    body: "Blockchain hanya menyimpan hash, kunci nomor seri, tanda tangan, dan waktu. File PDF dienkripsi AES-256.",
  },
  {
    title: "Penerbitan multi-signature",
    body: "Setiap ijazah ditandatangani kunci issuer di HSM/KMS dan butuh persetujuan beberapa pejabat.",
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
          Universitas menerbitkan, alumni menyimpan di vault pribadi, dan siapa pun dapat memverifikasi keaslian
          ijazah dalam hitungan detik.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/verify" className="btn-primary px-6 py-3 text-base">
            Verifikasi Ijazah
          </Link>
          <Link href="/vault" className="btn-secondary px-6 py-3 text-base">
            Buka Vault Saya
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card">
            <h2 className="mb-2 font-semibold text-brand-900">{f.title}</h2>
            <p className="text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
