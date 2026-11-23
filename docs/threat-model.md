# Threat Model — Vault Ijazah Digital (STRIDE)

Dokumen ini memetakan ancaman STRIDE ke kontrol yang diimplementasikan dan persyaratan keamanan (REQ-xx).

## Aset Utama

| Aset | Lokasi | Sensitivitas |
|---|---|---|
| File PDF ijazah | Supabase Storage (terenkripsi AES-256-GCM) | Tinggi (PII) |
| NIK, IPK | PostgreSQL (`*_encrypted`, AES-256-GCM via KMS) | Sangat tinggi |
| Nama, email, program studi | PostgreSQL (dilindungi RLS) | Tinggi |
| Kunci master KMS & kunci penanda tangan issuer | HSM/KMS (simulasi: env server) | Kritis |
| Kunci relayer / approver multi-sig | KMS / dompet hardware | Kritis |
| Hash dokumen, kunci seri, tanda tangan | Blockchain (publik) | Publik, non-PII |

## Batas Kepercayaan (Trust Boundaries)

1. Internet ↔ Edge/WAF (TLS 1.2+ diterminasi di sini)
2. Edge ↔ Next.js (middleware: CSP, sesi, MFA gate, CORS/CSRF)
3. Next.js ↔ Supabase (JWT pengguna → RLS; service role hanya di server)
4. Next.js ↔ KMS (antarmuka `KeyManagementService`, kunci tidak keluar)
5. Next.js ↔ Blockchain (RPC; tulis hanya via relayer approver)

## Analisis STRIDE

| Kategori | Ancaman | Kontrol | Lokasi kode | REQ |
|---|---|---|---|---|
| **S**poofing | Pengambilalihan akun alumni/issuer | Supabase Auth + MFA TOTP wajib (AAL2) di middleware, guard, dan RLS (`app_is_mfa()`) | `src/middleware.ts`, `src/lib/auth/guards.ts`, migrasi | REQ-03 |
| **S**poofing | Penerbit palsu mencatat ijazah | Tanda tangan KMS diverifikasi **on-chain** (`ecrecover` vs `kmsSigner`) + hanya `APPROVER_ROLE` | `contracts/DiplomaRegistry.sol` | REQ-04 |
| **S**poofing | Klaim ijazah orang lain via pendaftaran email | Penautan holder hanya setelah email terkonfirmasi | trigger `handle_user_email_confirmed` | REQ-06 |
| **T**ampering | PDF diubah setelah terbit | SHA-256 dicocokkan dengan hash on-chain yang immutable | `/api/verify`, `VerifyForm` | REQ-02 |
| **T**ampering | Penukaran file terenkripsi antar-ijazah | AES-GCM dengan AAD terikat `serialKey`; hash dicek ulang saat unduh | `src/lib/crypto/aes.ts`, route download | REQ-02 |
| **T**ampering | Replay tanda tangan ke kontrak/chain lain | Digest mengikat `address(this)` + `chainid` + serial + hash | `issuanceDigest()` | REQ-04 |
| **R**epudiation | Issuer menyangkal penerbitan/pencabutan | Event on-chain + `audit_logs` (hanya service role yang menulis) | `src/lib/audit.ts` | — |
| **I**nformation Disclosure | PII bocor ke blockchain publik | Hanya hash, `keccak256(serial)`, tanda tangan, timestamp yang on-chain | kontrak, `registry.ts` | REQ-02 |
| **I**nformation Disclosure | Akses langsung ke bucket storage | Bucket privat tanpa policy → hanya service role | migrasi (storage) | REQ-02 |
| **I**nformation Disclosure | Dokumen verifier dikirim ke server | Hash dihitung di browser; hanya hash yang dikirim | `VerifyForm.tsx` | REQ-05 |
| **I**nformation Disclosure | Sniffing jaringan | HTTPS wajib, HSTS preload, `upgrade-insecure-requests` | `next.config.ts`, middleware | REQ-01 |
| **I**nformation Disclosure | Kebocoran token tautan berbagi dari DB | Hanya HMAC token yang disimpan; token 256-bit, kedaluwarsa, dapat dicabut | `/api/vault/share`, `share_links` | REQ-06 |
| **D**enial of Service | Banjir permintaan verifikasi | Rate limit per IP + batas payload; WAF/edge rate limit sebagai lapisan pertama | `rate-limit.ts`, `/api/verify` | REQ-05 |
| **D**enial of Service | Unggahan besar / bom PDF | Batas ukuran, validasi struktur PDF, pemindaian ClamAV | `file-validation.ts` | REQ-05 |
| **E**levation of Privilege | Holder mengubah perannya sendiri | Hak `UPDATE` hanya kolom `full_name`; peran dibaca dari DB, bukan klaim klien | migrasi, `guards.ts` | REQ-06 |
| **E**levation of Privilege | Issuer membaca data institusi lain | RLS `institution_id = app_current_institution()` | migrasi | REQ-06 |
| **E**levation of Privilege | Satu kunci bocor → ijazah palsu | Multi-sig M-dari-N + TTL proposal 7 hari | kontrak | REQ-04 |
| **E**levation of Privilege | XSS mencuri sesi | CSP nonce + `strict-dynamic`, cookie httpOnly, React escaping | middleware | — |
| **E**levation of Privilege | CSRF pada API yang mengubah state | Validasi header `Origin`, CORS allowlist hanya `/api/verify` | middleware | REQ-06 |

## OWASP Top 10 (2021)

| OWASP | Kontrol |
|---|---|
| A01 Broken Access Control | RLS, `requireRole`, filter kepemilikan eksplisit, CSRF check |
| A02 Cryptographic Failures | AES-256-GCM, envelope encryption, HSTS, HMAC token |
| A03 Injection | Query builder Supabase (parameterized), validasi Zod, regex nomor seri |
| A04 Insecure Design | Arsitektur hybrid, threat model ini, multi-sig |
| A05 Security Misconfiguration | Security headers, `poweredByHeader: false`, env tervalidasi |
| A06 Vulnerable Components | npm audit, Dependabot, dependency-review |
| A07 Identification & Auth Failures | MFA wajib, pesan error generik, kata sandi min. 12 karakter |
| A08 Software & Data Integrity | Hash on-chain, cek ABI di CI, Slither/Mythril, lockfile |
| A09 Logging & Monitoring | `audit_logs`, event on-chain |
| A10 SSRF | Tidak ada fetch URL dari input pengguna; RPC & ClamAV dari konfigurasi |

## Risiko Tersisa & Rekomendasi Produksi

1. **Simulasi KMS** menyimpan kunci di env proses — ganti dengan KMS/HSM terkelola (AWS KMS `ECC_SECG_P256K1` untuk tanda tangan, envelope encryption untuk DEK).
2. **Admin kontrak** sebaiknya Safe multisig; `setKmsSigner`/`setThreshold` saat ini dapat dipanggil satu admin.
3. **Rate limiter** in-memory bersifat per instance — gunakan Redis/Upstash + aturan WAF (Cloudflare/AWS WAF).
4. **Persetujuan approver** yang dicabut perannya tetap terhitung pada proposal yang sedang berjalan (dibatasi TTL 7 hari).
5. **Rotasi kunci signer**: ijazah lama tetap valid on-chain; UI menandai "kunci issuer sebelumnya".
6. Aktifkan **konfirmasi email** wajib di Supabase Auth (prasyarat penautan ijazah yang aman).
