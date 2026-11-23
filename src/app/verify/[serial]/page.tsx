import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { VerificationResult } from "@/components/VerificationResult";
import { verifyBySerial } from "@/lib/chain/registry";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ serial: string }> };

const SERIAL_RE = /^[A-Za-z0-9\-/._]{3,64}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serial } = await params;
  return {
    title: `Verifikasi Ijazah ${decodeURIComponent(serial)}`,
    // Halaman per-ijazah tidak diindeks mesin pencari (privasi); halaman /verify yang dioptimasi SEO.
    robots: { index: false, follow: false },
  };
}

export default async function VerifySerialPage({ params }: Props) {
  const serial = decodeURIComponent((await params).serial);

  if (!SERIAL_RE.test(serial)) {
    return <Message title="Nomor seri tidak valid" body="Periksa kembali nomor seri pada ijazah." />;
  }

  const env = serverEnv();
  const ip = clientIp(await headers());
  if (!rateLimit(`verify:${ip}`, env.RATE_LIMIT_VERIFY_MAX, env.RATE_LIMIT_WINDOW_MS).allowed) {
    return <Message title="Terlalu banyak permintaan" body="Silakan coba lagi dalam beberapa saat." />;
  }

  let result;
  try {
    result = await verifyBySerial(serial);
  } catch {
    return <Message title="Layanan sedang tidak tersedia" body="Tidak dapat terhubung ke jaringan blockchain." />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Hasil Verifikasi</h1>
      <VerificationResult result={result} details={[{ label: "Nomor seri", value: serial }]} />
      <p className="text-sm text-slate-600">
        Verifikasi nomor seri memastikan ijazah terdaftar. Untuk memastikan <strong>file PDF</strong> yang Anda terima
        tidak diubah, unggah file tersebut di{" "}
        <Link href="/verify" className="text-brand-700 underline">
          halaman verifikasi
        </Link>{" "}
        dan bandingkan hash-nya.
      </p>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="card space-y-2">
      <h1 className="text-xl font-semibold text-brand-900">{title}</h1>
      <p className="text-slate-600">{body}</p>
    </div>
  );
}
