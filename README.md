# 🎓 Vault Ijazah Digital Berbasis Blockchain

> **Aplikasi Vault Dokumen dan Sertifikat Digital Berbasis Web (Ijazah Digital Berbasis Blockchain)**
> Platform penerbitan, penyimpanan, dan verifikasi ijazah digital yang aman dengan arsitektur hybrid *on-chain/off-chain* dan pendekatan DevSecOps.

---

## 📌 Daftar Isi

1. [Gambaran Umum](#-gambaran-umum)
2. [Arsitektur Sistem](#-arsitektur-sistem)
3. [Tech Stack](#-tech-stack)
4. [Fitur Utama](#-fitur-utama)
5. [Alur Kerja (Dual-Flow)](#-alur-kerja-dual-flow)
6. [Struktur Direktori](#-struktur-direktori)
7. [Keamanan & DevSecOps](#-keamanan--devsecops)
8. [Instalasi & Menjalankan Proyek](#-instalasi--menjalankan-proyek)
9. [Variabel Lingkungan](#-variabel-lingkungan)
10. [Pipeline CI/CD](#-pipeline-cicd)
11. [Kontribusi](#-kontribusi)
12. [Lisensi](#-lisensi)

---

## 🧭 Gambaran Umum

Pemalsuan ijazah adalah masalah serius dalam proses rekrutmen dan penerimaan akademik. Verifikasi manual ke institusi penerbit lambat, mahal, dan rawan kesalahan.

**Vault Ijazah Digital** menyelesaikan masalah ini dengan:

- **Integritas yang tidak dapat diubah** — sidik jari kriptografis (SHA-256) setiap ijazah dicatat secara permanen di *blockchain*.
- **Privasi data** — dokumen fisik dan data pribadi (PII) disimpan terenkripsi AES-256 di luar rantai (*off-chain*); **tidak ada PII yang disimpan on-chain**.
- **Verifikasi instan tanpa login** — pemberi kerja atau pihak ketiga cukup mengunggah PDF atau memindai kode QR.
- **Kepemilikan oleh pemegang ijazah** — mahasiswa/alumni memiliki *vault* pribadi untuk mengelola dan membagikan ijazahnya.

### Pemangku Kepentingan

| Peran | Deskripsi | Akses |
|---|---|---|
| **Issuer** (Universitas) | Menerbitkan dan mencabut ijazah | Login + MFA, peran `issuer` |
| **Holder** (Mahasiswa/Alumni) | Melihat, mengunduh, dan membagikan ijazah | Login + MFA, peran `holder` |
| **Verifier** (Publik/Pemberi Kerja) | Memverifikasi keaslian ijazah | Publik, tanpa login (dibatasi *rate limit*) |
| **Admin** | Mengelola akun issuer dan konfigurasi sistem | Login + MFA, peran `admin` |

---

## 🏗️ Arsitektur Sistem

Sistem menggunakan **arsitektur hybrid on-chain/off-chain**:

```
                ┌───────────────────────────────────────────┐
                │        Pengguna (Browser / Mobile)        │
                └──────────────────────┬────────────────────┘
                                       │ HTTPS / TLS 1.2+
                ┌──────────────────────▼────────────────────┐
                │  DMZ / API Gateway (WAF, CORS, Rate Limit)│
                └──────────────────────┬────────────────────┘
                                       │
                ┌──────────────────────▼────────────────────┐
                │      Next.js (SSR + API Routes)           │
                │  Middleware: JWT, RBAC, Security Headers  │
                └───────┬──────────────┬──────────────┬─────┘
                        │              │              │
         ┌──────────────▼───┐  ┌───────▼───────┐  ┌───▼────────────────┐
         │    Supabase      │  │  HSM / KMS    │  │  Blockchain (EVM)  │
         │ ─ PostgreSQL+RLS │  │  (Simulasi)   │  │ ─ DiplomaRegistry  │
         │ ─ Auth (JWT+MFA) │  │ ─ Kunci issuer│  │ ─ Multi-Signature  │
         │ ─ Storage (PDF   │  │ ─ Wrap kunci  │  │ ─ Hash, serial,    │
         │   terenkripsi    │  │   data (DEK)  │  │   tanda tangan,    │
         │   AES-256-GCM)   │  │               │  │   timestamp        │
         └──────────────────┘  └───────────────┘  └────────────────────┘
              OFF-CHAIN                                 ON-CHAIN
       (data pribadi & dokumen)                  (bukti integritas saja)
```

### Pemisahan Data

| Data | Lokasi | Keterangan |
|---|---|---|
| File PDF ijazah | Supabase Storage (privat) | Terenkripsi AES-256-GCM per file (*envelope encryption*) |
| Data pribadi (nama, NIK, IPK, dll.) | Supabase PostgreSQL | Dilindungi RLS; kolom sensitif dienkripsi |
| Hash SHA-256 dokumen | Blockchain | Bukti integritas, tidak dapat diubah |
| Nomor seri ijazah | Blockchain | Pengenal publik non-PII |
| Tanda tangan digital issuer | Blockchain | Dihasilkan via HSM/KMS |
| Timestamp & status (aktif/dicabut) | Blockchain | Mendukung pencabutan (*revocation*) |

> ⚠️ **Prinsip utama:** data pribadi **tidak pernah** ditulis ke blockchain.

---

## 🧰 Tech Stack

| Lapisan | Teknologi |
|---|---|
| Frontend & Framework | Next.js (App Router, SSR, SEO untuk halaman verifikasi publik) |
| Styling / UI | Tailwind CSS |
| Backend & Database | Supabase (PostgreSQL, Auth, Row Level Security) |
| Penyimpanan Off-Chain | Supabase Storage + enkripsi AES-256-GCM di sisi aplikasi |
| Smart Contract | Solidity, OpenZeppelin |
| Lingkungan Pengembangan Kontrak | Hardhat |
| Integrasi Web3 | Viem |
| Manajemen Kunci | Simulasi HSM/KMS (dapat diganti AWS KMS / GCP KMS / HashiCorp Vault) |
| CI/CD & Keamanan | GitHub Actions, Slither, Mythril, npm audit / SCA, secret scanning |

---

## ✨ Fitur Utama

### 1. Penerbitan Ijazah (Issuer)
- Unggah PDF ijazah (tunggal atau batch).
- Validasi format (*magic bytes*, ukuran, tipe MIME) dan pemindaian malware.
- Perhitungan hash SHA-256 dan enkripsi AES-256-GCM.
- Penandatanganan payload menggunakan simulasi HSM/KMS.
- *Minting* ke smart contract dengan persetujuan multi-signature.
- Pencabutan (*revocation*) ijazah yang bermasalah.

### 2. Verifikasi Publik (Verifier)
- Unggah PDF **atau** pindai kode QR / buka tautan verifikasi.
- Hash dihitung ulang dan dibandingkan dengan data on-chain.
- Hasil instan: ✅ **Asli & Valid**, ⛔ **Dicabut**, atau ❌ **Tidak Ditemukan / Dipalsukan**.
- Tanpa login; dilindungi *rate limiting* dan aturan WAF.
- Halaman verifikasi dirender di server (SSR) dan ramah SEO.

### 3. Vault Pribadi (Holder)
- Login aman via Supabase Auth dengan MFA (TOTP/FIDO2).
- Melihat daftar ijazah milik sendiri.
- Mengunduh PDF secara aman (didekripsi di server, tautan berumur pendek).
- Membuat tautan verifikasi dan kode QR yang dapat dibagikan, dengan masa berlaku yang dapat diatur dan dapat dicabut.

---

## 🔄 Alur Kerja (Dual-Flow)

### A. Alur Penerbitan (Issuance / Minting)

```
Issuer unggah PDF
   │
   ▼
Validasi format + pemindaian malware
   │
   ▼
Hitung hash SHA-256 dari PDF final
   │
   ▼
Enkripsi PDF (AES-256-GCM) ──► Simpan di Supabase Storage (off-chain)
   │
   ▼
Tanda tangani payload {hash, serial, timestamp} via HSM/KMS
   │
   ▼
Usulan mint ──► Persetujuan multi-sig ──► Catat on-chain
   │
   ▼
Simpan metadata + tx hash di PostgreSQL (dengan RLS)
```

> 💡 **Catatan penting:** hash dihitung dari **PDF final** (termasuk kode QR/nomor seri yang tertanam). Setiap modifikasi setelah hashing akan membuat verifikasi gagal.

### B. Alur Verifikasi Publik

```
Verifier unggah PDF / pindai QR
   │
   ▼
Hitung ulang hash SHA-256 (atau ambil serial dari QR)
   │
   ▼
Baca data dari smart contract (read-only)
   │
   ▼
Bandingkan hash + cek status + validasi tanda tangan issuer
   │
   ▼
Hasil: VALID / DICABUT / TIDAK VALID
```

---

## 📁 Struktur Direktori

```
/
├── .github/
│   ├── workflows/devsecops.yml # CI: typecheck, build, test, Slither, Mythril, CodeQL, SCA, Gitleaks
│   └── dependabot.yml          # Pembaruan dependensi otomatis
├── contracts/
│   └── DiplomaRegistry.sol     # Registri ijazah + multi-sig M-of-N + verifikasi tanda tangan KMS
├── scripts/
│   ├── deploy.ts               # Deploy kontrak (lokal / Sepolia)
│   ├── approve.ts              # Persetujuan approver kedua (multi-sig)
│   ├── export-abi.mjs          # Ekspor ABI → src/lib/chain/abi.ts
│   └── generate-keys.mjs       # Material kunci untuk pengembangan lokal
├── test/
│   └── DiplomaRegistry.ts      # Unit test kontrak (10 skenario)
├── supabase/
│   ├── migrations/             # Skema, RBAC, RLS, bucket privat
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── verify/             # Verifikasi publik (SEO) + /verify/[serial] (SSR)
│   │   ├── share/[token]/      # Tautan berbagi dari pemegang ijazah
│   │   ├── login/, mfa/        # Autentikasi + MFA TOTP wajib
│   │   ├── vault/              # Vault pemegang ijazah
│   │   ├── issuer/             # Dasbor issuer
│   │   └── api/
│   │       ├── verify/                        # POST — verifikasi publik (rate limited)
│   │       ├── issuer/diplomas/               # POST — penerbitan
│   │       ├── issuer/diplomas/[id]/sync      # POST — sinkron status on-chain
│   │       ├── issuer/diplomas/[id]/revoke    # POST — usulan pencabutan
│   │       ├── vault/diplomas/[id]/download   # GET  — unduh terdekripsi
│   │       └── vault/share/                   # POST — tautan + QR code
│   ├── components/             # Komponen UI (Tailwind CSS)
│   ├── lib/
│   │   ├── supabase/           # Klien server / browser / admin (service role)
│   │   ├── crypto/             # SHA-256, HMAC, AES-256-GCM
│   │   ├── kms/                # Antarmuka KMS + simulasi HSM
│   │   ├── chain/              # Klien Viem, ABI, verifikasi & proposal
│   │   ├── security/           # Rate limit, validasi PDF, ClamAV
│   │   ├── auth/guards.ts      # requireRole: JWT + AAL2 + peran dari DB
│   │   ├── audit.ts            # Jejak audit
│   │   └── env.ts              # Validasi environment (Zod)
│   └── middleware.ts           # CSP nonce, sesi, gate MFA, CORS/CSRF
├── docs/threat-model.md        # STRIDE & OWASP Top 10 ↔ kontrol
├── .env.example
├── hardhat.config.ts, next.config.ts, tsconfig*.json
├── slither.config.json, mythril.solc.json
└── README.md
```

---

## 🔐 Keamanan & DevSecOps

### Persyaratan Keamanan

| Kode | Persyaratan | Implementasi | STRIDE | OWASP Top 10 |
|---|---|---|---|---|
| **REQ-01** | HTTPS/TLS 1.2+ wajib | HSTS, redirect HTTPS, TLS di gateway/hosting | Information Disclosure, Tampering | A02 Cryptographic Failures |
| **REQ-02** | Isolasi penyimpanan off-chain + AES-256, tanpa PII on-chain | Envelope encryption AES-256-GCM, bucket privat, hanya hash on-chain | Information Disclosure | A02, A04 Insecure Design |
| **REQ-03** | Autentikasi stateless JWT + MFA | Supabase Auth, TOTP/FIDO2, verifikasi AAL2 di middleware | Spoofing | A07 Identification & Authentication Failures |
| **REQ-04** | Proteksi kunci privat issuer | Simulasi HSM/KMS (kunci tidak pernah keluar modul), kontrak multi-signature | Spoofing, Elevation of Privilege | A02, A04 |
| **REQ-05** | Mesin verifikasi publik read-only dengan Rate Limit & WAF | Rate limiting per IP, batas ukuran upload, aturan WAF, endpoint read-only | Denial of Service | A04, A05 Security Misconfiguration |
| **REQ-06** | RBAC ketat | Kebijakan RLS Supabase + pemeriksaan peran di middleware & API | Elevation of Privilege | A01 Broken Access Control |

### Kontrol Tambahan
- **Security headers:** CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Validasi input:** skema validasi untuk semua input API; validasi *magic bytes* PDF.
- **Audit log:** setiap penerbitan, pencabutan, dan unduhan dicatat (*Repudiation*).
- **Manajemen secret:** tidak ada secret di repositori; gunakan secret manager / GitHub Secrets.
- **Least privilege:** *service role key* Supabase hanya digunakan di server.

---

## 🚀 Instalasi & Menjalankan Proyek

### Prasyarat
- Node.js ≥ 20.9 (diuji dengan Node 24)
- Supabase CLI + Docker (untuk Supabase lokal) atau proyek Supabase cloud
- Python 3 (opsional, untuk menjalankan Slither/Mythril secara lokal)

### Langkah

```bash
# 1. Instal dependensi
npm install

# 2. Siapkan environment
cp .env.example .env.local
npm run keys:generate          # salin outputnya ke .env.local

# 3. Supabase (lokal) — salin anon key & service role key dari output `status` ke .env.local
npx supabase init              # sekali saja
npx supabase start
npx supabase db reset          # menjalankan migrasi + seed.sql
#    Wajib: aktifkan konfirmasi email & MFA TOTP di pengaturan Auth

# 4. Blockchain lokal (terminal terpisah)
npm run chain:node
npm run chain:deploy:local     # salin DIPLOMA_REGISTRY_ADDRESS ke .env.local

# 5. Jalankan aplikasi
npm run dev                    # http://localhost:3000
```

### Menjadikan pengguna sebagai issuer

```sql
update public.profiles
set role = 'issuer',
    institution_id = (select id from public.institutions where code = 'UNIV-DEMO')
where email = 'issuer@contoh.ac.id';
```

### Persetujuan multi-sig

Penerbitan dari dasbor issuer otomatis menjadi persetujuan pertama (relayer server).
Dengan `MULTISIG_THRESHOLD=2`, approver kedua harus menyetujui:

```bash
PROPOSAL_ID=1 npm run chain:approve -- --network localhost
```

Lalu klik **Sinkron status** di dasbor issuer.

### Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run contracts:test` | Unit test smart contract |
| `npm run contracts:abi` | Kompilasi & ekspor ulang ABI ke `src/lib/chain/abi.ts` |
| `npm run typecheck` | Type check aplikasi + kode Hardhat |
| `npm run audit:deps` | Pemindaian kerentanan dependensi produksi |

---

## ⚙️ Variabel Lingkungan

Lihat `.env.example`. Ringkasan:

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kunci publik (anon) Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci service role — **hanya server** |
| `KMS_MASTER_KEY` | Kunci master simulasi KMS — **hanya server** |
| `RPC_URL` | Endpoint RPC blockchain |
| `CHAIN_ID` | ID jaringan blockchain |
| `DIPLOMA_REGISTRY_ADDRESS` | Alamat kontrak DiplomaRegistry |
| `RATE_LIMIT_*` | Konfigurasi rate limiting |

> ⚠️ Jangan pernah melakukan commit file `.env` / `.env.local`.

---

## 🛡️ Pipeline CI/CD

Setiap *push* dan *pull request* menjalankan:

1. **Type check & build** — TypeScript, `next build`, dan pemeriksaan ABI tetap sinkron dengan kontrak.
2. **Unit test kontrak** — Hardhat.
3. **SAST smart contract** — Slither (hasil SARIF ke tab Security GitHub) dan Mythril (*symbolic execution*).
4. **SAST aplikasi** — CodeQL `security-extended`.
5. **SCA** — `npm audit` (high+), *dependency review* pada PR, Dependabot.
6. **Secret scanning** — Gitleaks.
7. **Security gate** — deployment hanya boleh berjalan bila semua pemeriksaan lolos.

---

## 🤝 Kontribusi

1. Buat branch fitur: `git checkout -b feat/nama-fitur`
2. Commit dengan format *Conventional Commits*.
3. Pastikan semua pemeriksaan CI lolos.
4. Buka Pull Request dan minta review.

---

## 📄 Lisensi

Ditentukan oleh tim proyek (mis. MIT).
