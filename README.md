# 🎓 Vault Ijazah Digital Berbasis Blockchain

> **Aplikasi Vault Dokumen dan Sertifikat Digital Berbasis Web (Ijazah Digital Berbasis Blockchain)**
> Penerbitan dan verifikasi ijazah dengan arsitektur hybrid *on-chain/off-chain* dan pipeline DevSecOps.

Kampus mengunggah PDF ijazah, sistem mencatat **sidik jari SHA-256**-nya di blockchain, dan siapa pun bisa mengecek keasliannya tanpa login. Perubahan sekecil apa pun pada file PDF akan terdeteksi.

> Seluruh data ijazah di proyek ini **fiktif** dan hanya untuk demonstrasi.

---

## 👥 Peran

| Peran | Siapa | Hak | Akses |
|---|---|---|---|
| **Admin** | Pejabat kampus | Menerbitkan, **mencabut**, membaca audit log | Login + MFA |
| **Issuer** | Staf akademik | Menerbitkan, mengunduh PDF | Login + MFA |
| **Verifier** | Publik / HRD | Memverifikasi ijazah | Tanpa login (rate limited) |

Akun baru **tidak punya peran** sampai admin memberikannya (*deny by default*).

---

## 🏗️ Arsitektur

```
 Verifier ──┐                                   ┌──► Supabase (off-chain)
            ├──► Vercel ──► Next.js (UI + API) ─┤      ├─ Auth + MFA
 Staf ──────┘    Firewall    Middleware: CSP,   │      ├─ Postgres + RLS (metadata, audit_logs)
                             sesi, MFA, CSRF    │      └─ Storage privat (PDF)
                                                │
                                                └──► Blockchain EVM (on-chain)
                                                       └─ DiplomaRegistry: hash + status
```

### Apa disimpan di mana

| Data | Lokasi | Alasan |
|---|---|---|
| File PDF ijazah | Supabase Storage, bucket **privat** | Hanya server yang bisa akses; unduhan via signed URL 60 detik |
| Nama, NIM, prodi, tanggal lulus | Supabase Postgres + RLS | Hanya staf yang sudah MFA yang bisa membaca |
| Audit log & kejadian keamanan | Supabase Postgres (`audit_logs`) | Jejak audit, sumber data monitoring |
| Hash SHA-256 PDF | Blockchain | Bukti integritas yang tidak bisa diubah |
| `keccak256(nomor seri)` | Blockchain | Kunci pencarian, bukan data pribadi |
| Waktu terbit / cabut | Blockchain | Status VALID / DICABUT |

> ⚠️ **Data pribadi tidak pernah ditulis ke blockchain.**

---

## 🔄 Alur

**Penerbitan** (`POST /api/issuer/diplomas`)

```
Validasi PDF (magic bytes, ukuran, fitur aktif berbahaya)
  → hitung SHA-256
  → simpan PDF ke bucket privat
  → issue(serialKey, docHash) di blockchain
  → simpan metadata + tx hash
  → tampilkan QR ke /verify/<nomor-seri>
```

**Verifikasi** (`/verify`, tanpa login)

```
Unggah PDF → hash dihitung DI BROWSER (file tidak dikirim)
  → getByHash() di blockchain (gratis, read-only)
  → VALID / DICABUT / TIDAK DITEMUKAN
```

Atau scan QR → `/verify/<nomor-seri>` → `getBySerial()`.

**Pencabutan** (`POST /api/issuer/diplomas/:id/revoke`, khusus admin): status on-chain menjadi DICABUT, catatan terbit tetap ada.

---

## ⛓️ Smart Contract

`contracts/DiplomaRegistry.sol` (OpenZeppelin `AccessControl`)

| Fungsi | Siapa | Keterangan |
|---|---|---|
| `issue(serialKey, docHash)` | `ISSUER_ROLE` | Tolak nilai kosong, serial ganda, hash ganda |
| `revoke(serialKey)` | `ISSUER_ROLE` | Tolak bila belum terbit / sudah dicabut |
| `getBySerial`, `getByHash` | Publik | `view`, tanpa gas |
| `grantRole`, `revokeRole` | `DEFAULT_ADMIN_ROLE` | Rotasi dompet relayer |

| Peran on-chain | Dipegang oleh |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Dompet admin kampus (MetaMask) |
| `ISSUER_ROLE` | Dompet server (relayer) yang membayar gas |

**Respon insiden:** jika kunci relayer bocor, admin mencabut `ISSUER_ROLE` dari alamat lama dan memberikannya ke relayer baru. Skenario ini diuji di unit test.

---

## 📁 Struktur Direktori

```
├── .github/workflows/devsecops.yml  # CI: test, Slither, Semgrep, npm audit, Gitleaks, security gate
├── contracts/DiplomaRegistry.sol
├── test/DiplomaRegistry.ts          # 13 unit test kontrak
├── scripts/
│   ├── deploy.ts                    # deploy lokal / Base Sepolia
│   ├── export-abi.mjs               # ABI → src/lib/chain/abi.ts
│   └── generate-keys.mjs            # kunci relayer untuk dev/testnet
├── supabase/migrations/             # tabel, RLS, bucket privat
├── docs/threat-model.md             # STRIDE + OWASP Top 10
└── src/
    ├── middleware.ts                # CSP nonce, sesi, gate MFA, CSRF
    ├── app/
    │   ├── page.tsx                 # beranda
    │   ├── login/, mfa/             # autentikasi + MFA TOTP
    │   ├── issuer/                  # dasbor kampus (terbit, cabut, unduh)
    │   ├── verify/, verify/[serial] # verifikasi publik
    │   └── api/
    │       ├── issuer/diplomas/                 # POST terbitkan
    │       ├── issuer/diplomas/[id]/revoke      # POST cabut (admin)
    │       ├── issuer/diplomas/[id]/download    # GET unduh PDF
    │       └── verify/                          # POST verifikasi (rate limited)
    ├── components/
    └── lib/
        ├── auth/guards.ts           # requireRole: JWT + MFA + peran dari DB
        ├── chain/                   # Viem client, ABI
        ├── security/                # rate limit, validasi PDF
        ├── audit.ts                 # audit log (DB + JSON stdout)
        └── env.ts                   # validasi env (Zod)
```

---

## 🚀 Menjalankan Secara Lokal

Prasyarat: Node.js ≥ 20.9, Supabase CLI + Docker.

```bash
npm install
cp .env.example .env.local
npm run keys:generate            # salin ISSUER_RELAYER_PRIVATE_KEY ke .env.local

npx supabase start               # salin anon key & service role key ke .env.local
npx supabase db reset            # migrasi + seed
#   Aktifkan MFA TOTP di pengaturan Auth

npm run chain:node               # terminal terpisah
npm run chain:deploy:local       # salin DIPLOMA_REGISTRY_ADDRESS ke .env.local

npm run dev                      # http://localhost:3000
```

Beri peran ke akun staf (setelah mendaftar di `/login`):

```sql
update public.profiles set role = 'admin'  where email = 'admin@kampus-demo.ac.id';
update public.profiles set role = 'issuer' where email = 'issuer@kampus-demo.ac.id';
```

### Deploy kontrak ke testnet (Base Sepolia)

```bash
# isi BASE_SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, ISSUER_RELAYER_PRIVATE_KEY di .env.local
# isi saldo deployer + relayer dari faucet Base Sepolia
npm run chain:deploy:testnet
# lalu set RPC_URL=https://sepolia.base.org, CHAIN_ID=84532, DIPLOMA_REGISTRY_ADDRESS=<hasil>
```

### Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run contracts:test` | Unit test smart contract |
| `npm run contracts:abi` | Kompilasi & ekspor ulang ABI |
| `npm run typecheck` | Type check aplikasi + kode Hardhat |
| `npm run audit:deps` | Pemindaian kerentanan dependensi |

---

## ⚙️ Variabel Lingkungan

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL aplikasi (dipakai di QR) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Koneksi Supabase (publik) |
| `SUPABASE_SERVICE_ROLE_KEY` | Melewati RLS — **hanya server** |
| `RPC_URL`, `CHAIN_ID`, `DIPLOMA_REGISTRY_ADDRESS` | Koneksi blockchain |
| `ISSUER_RELAYER_PRIVATE_KEY` | Kunci dompet relayer — **hanya server** |
| `MAX_UPLOAD_BYTES`, `RATE_LIMIT_*` | Batas unggahan & rate limit |

> ⚠️ Jangan pernah commit `.env` / `.env.local`. Di Vercel, simpan secret sebagai *Sensitive Environment Variables*.

---

## 🛡️ Pipeline CI/CD

Setiap *push* dan *pull request* ke `main` menjalankan job paralel berikut. Pipeline **gagal** bila ada temuan berisiko tinggi.

| Job | Tool | Gagal bila |
|---|---|---|
| App | `tsc`, `next build`, cek ABI sinkron | Error build/type |
| Contracts | Hardhat test | Test gagal |
| SAST kontrak | Slither | Temuan ≥ medium |
| SAST aplikasi | Semgrep (OWASP Top 10) | Temuan severity ERROR |
| SCA | `npm audit`, dependency review | Kerentanan ≥ high |
| Secrets | Gitleaks | Secret terdeteksi |
| **Security gate** | — | Salah satu job di atas gagal |

---

## 🤝 Kontribusi

1. Buat branch fitur: `git checkout -b feat/nama-fitur`
2. Commit dengan format *Conventional Commits*.
3. Pastikan semua pemeriksaan CI lolos.
4. Buka Pull Request dan minta review.
