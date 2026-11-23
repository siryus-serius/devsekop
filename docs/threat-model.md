# Threat Model — Vault Ijazah Digital (STRIDE)

Dokumen ini memetakan ancaman (STRIDE) ke kontrol yang sudah diimplementasikan, beserta lokasi kodenya.

## Aset

| Aset | Lokasi | Sensitivitas |
|---|---|---|
| File PDF ijazah | Supabase Storage, bucket privat | Tinggi |
| Nama, NIM, prodi, tanggal lulus (fiktif) | Supabase Postgres (RLS) | Tinggi |
| Akun staf (admin / issuer) | Supabase Auth + MFA | Kritis |
| `SUPABASE_SERVICE_ROLE_KEY` | Env server (Vercel Sensitive Env) | Kritis |
| Kunci relayer (`ISSUER_ROLE`) | Env server (Vercel Sensitive Env) | Kritis |
| Kunci admin kontrak (`DEFAULT_ADMIN_ROLE`) | Dompet admin (MetaMask) | Kritis |
| Hash dokumen, `keccak256(serial)`, waktu | Blockchain (publik) | Publik, bukan PII |
| `audit_logs` | Supabase Postgres | Sedang |

## Aktor Ancaman

| Aktor | Tujuan |
|---|---|
| Pemalsu ijazah | Membuat PDF palsu yang lolos verifikasi |
| Penyerang eksternal | Mengambil alih akun staf, mencuri data, membanjiri layanan |
| Orang dalam / kunci bocor | Menerbitkan atau mencabut ijazah tanpa hak |

## Batas Kepercayaan (Trust Boundaries)

1. Internet ↔ Vercel Edge (TLS, Vercel Firewall)
2. Edge ↔ Next.js (middleware: CSP, sesi, gate MFA, CSRF)
3. Next.js ↔ Supabase (JWT pengguna → RLS; service role hanya di server)
4. Next.js ↔ Blockchain (RPC; tulis hanya oleh relayer pemegang `ISSUER_ROLE`)

## Analisis STRIDE

| Kategori | Ancaman | Kontrol | Lokasi kode |
|---|---|---|---|
| **S**poofing | Pengambilalihan akun staf | Supabase Auth + MFA TOTP wajib (AAL2) di middleware, guard, dan RLS (`app_is_mfa()`) | `src/middleware.ts`, `src/lib/auth/guards.ts`, migrasi |
| **S**poofing | Pihak lain mencatat ijazah palsu ke kontrak | Hanya alamat pemegang `ISSUER_ROLE` yang bisa memanggil `issue`/`revoke` | `contracts/DiplomaRegistry.sol` |
| **S**poofing | Akun baru mendaftar lalu mengakses dasbor | Akun baru tanpa peran (*deny by default*); peran hanya diberi admin | migrasi (`profiles.role` NULL) |
| **T**ampering | PDF ijazah diedit (nama, IPK, dll.) | Hash SHA-256 dibandingkan dengan hash on-chain yang tidak bisa diubah | `VerifyForm.tsx`, `/api/verify` |
| **T**ampering | Data di database diubah | Hash on-chain adalah sumber kebenaran; pengguna tidak punya hak `INSERT/UPDATE/DELETE` | migrasi (hanya `SELECT`) |
| **T**ampering | PDF berbahaya diunggah (JavaScript, embedded file) | Validasi magic bytes, ukuran, penanda EOF, tolak `/JavaScript`, `/Launch`, dll. | `src/lib/security/file-validation.ts` |
| **R**epudiation | Staf menyangkal menerbitkan/mencabut | Event on-chain (`DiplomaIssued`, `DiplomaRevoked`) + `audit_logs` dengan `actor_id`, IP, waktu | `src/lib/audit.ts`, kontrak |
| **I**nformation Disclosure | PII bocor ke blockchain publik | Hanya hash, `keccak256(serial)`, dan waktu yang on-chain | kontrak, `registry.ts` |
| **I**nformation Disclosure | Akses langsung ke file PDF | Bucket privat tanpa policy; unduh hanya via signed URL 60 detik setelah cek peran | migrasi, route `download` |
| **I**nformation Disclosure | Dokumen milik verifier dikirim ke server | Hash dihitung di browser; hanya hash yang dikirim | `VerifyForm.tsx` |
| **I**nformation Disclosure | Secret bocor di repositori | `.env*` di-gitignore, Gitleaks di CI, secret di Vercel/GitHub Secrets | `.gitignore`, workflow |
| **I**nformation Disclosure | Sniffing jaringan | HTTPS wajib, HSTS preload, `upgrade-insecure-requests` | `next.config.ts`, middleware |
| **D**enial of Service | Banjir permintaan verifikasi | Rate limit per IP + batas payload + Vercel Firewall; kejadian dicatat `warning` | `rate-limit.ts`, `/api/verify` |
| **D**enial of Service | Unggahan sangat besar | Batas ukuran sebelum membaca body | route penerbitan |
| **E**levation of Privilege | Issuer mencabut ijazah | Pencabutan hanya untuk peran `admin` | route `revoke` |
| **E**levation of Privilege | Peran dimanipulasi dari klien | Peran dibaca dari DB di server; pengguna tidak bisa menulis tabel | `guards.ts`, migrasi |
| **E**levation of Privilege | Kunci relayer bocor → ijazah palsu | Relayer tidak bisa memberi peran; admin mencabut `ISSUER_ROLE` lama (diuji di unit test) | kontrak, `test/DiplomaRegistry.ts` |
| **E**levation of Privilege | XSS mencuri sesi | CSP nonce per request, cookie httpOnly, React escaping | `src/middleware.ts` |
| **E**levation of Privilege | CSRF pada API | Request non-GET wajib dari origin yang sama | `src/middleware.ts` |

## Pemetaan OWASP Top 10 (2021)

| OWASP | Kontrol |
|---|---|
| A01 Broken Access Control | RLS, `requireRole`, `AccessControl` on-chain, CSRF |
| A02 Cryptographic Failures | SHA-256, HTTPS/HSTS, storage terenkripsi at rest (Supabase) |
| A03 Injection | Validasi Zod, query terparameter Supabase, CSP |
| A04 Insecure Design | Threat model ini, data minimization, hash dihitung di browser |
| A05 Security Misconfiguration | Security headers, bucket privat, deny-by-default |
| A06 Vulnerable Components | `npm audit`, dependency review, Dependabot |
| A07 Identification & Auth Failures | MFA TOTP wajib, validasi JWT ke server Auth |
| A08 Software & Data Integrity | Hash on-chain, CI gate sebelum deploy, ABI dicek sinkron |
| A09 Logging & Monitoring | `audit_logs` (level info/warning/critical), event on-chain |
| A10 SSRF | Tidak ada fetch URL dari input pengguna |

## Risiko Tersisa

1. **Kunci relayer di env server** — dimitigasi: testnet, saldo kecil, peran bisa dicabut seketika. Produksi: KMS.
2. **Rate limiter in-memory per instance** — lapisan utama tetap Vercel Firewall; produksi: Redis/Upstash.
3. **Satu relayer bisa menerbitkan tanpa persetujuan kedua** — dimitigasi RBAC + MFA di aplikasi dan audit log.
4. **Admin kontrak satu dompet** — produksi: Safe multisig.
