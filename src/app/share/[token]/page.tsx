import type { Metadata } from "next";
import { headers } from "next/headers";
import { VerificationResult } from "@/components/VerificationResult";
import { verifyBySerial } from "@/lib/chain/registry";
import { hmacHex } from "@/lib/crypto/hash";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ijazah yang Dibagikan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Tautan berbagi dari pemegang ijazah. Menampilkan data identitas terbatas (nama, program studi)
 * karena pemegang secara eksplisit menyetujui pengungkapan, plus status on-chain.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const env = serverEnv();

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <Invalid />;
  if (!rateLimit(`share:${clientIp(await headers())}`, 30, 60_000).allowed) return <Invalid />;

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("share_links")
    .select("id, diploma_id, expires_at, revoked, view_count")
    .eq("token_hash", hmacHex(env.SHARE_TOKEN_PEPPER, token))
    .maybeSingle();

  if (!link || link.revoked || new Date(link.expires_at as string) < new Date()) return <Invalid />;

  const { data: diploma } = await admin
    .from("diplomas")
    .select("serial_number, holder_name, program, graduation_date, institutions(name)")
    .eq("id", link.diploma_id)
    .single();
  if (!diploma) return <Invalid />;

  await admin
    .from("share_links")
    .update({ view_count: (link.view_count as number) + 1 })
    .eq("id", link.id);

  const result = await verifyBySerial(diploma.serial_number as string);
  const institution = (diploma.institutions as unknown as { name: string } | null)?.name ?? "-";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Ijazah yang Dibagikan</h1>
      <VerificationResult
        result={result}
        details={[
          { label: "Nama", value: diploma.holder_name as string },
          { label: "Program studi", value: diploma.program as string },
          { label: "Institusi", value: institution },
          {
            label: "Tanggal lulus",
            value: new Date(diploma.graduation_date as string).toLocaleDateString("id-ID", { dateStyle: "long" }),
          },
          { label: "Nomor seri", value: diploma.serial_number as string },
        ]}
      />
      <p className="text-xs text-slate-500">
        Tautan ini berlaku hingga{" "}
        {new Date(link.expires_at as string).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}.
      </p>
    </div>
  );
}

function Invalid() {
  return (
    <div className="card space-y-2">
      <h1 className="text-xl font-semibold text-brand-900">Tautan tidak valid</h1>
      <p className="text-slate-600">Tautan ini tidak ditemukan, sudah kedaluwarsa, atau telah dicabut oleh pemiliknya.</p>
    </div>
  );
}
