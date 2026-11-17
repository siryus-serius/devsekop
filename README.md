# Vault Ijazah Digital

Sistem verifikasi integritas dan penerbitan ijazah digital berbasis cryptographic hash dan dynamic QR code tanpa ketergantungan pihak ketiga.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router), React 19
- **Bahasa Pemrograman**: TypeScript, JavaScript
- **Styling**: Tailwind CSS
- **Library Kunci**:
  - `crypto` (Node.js built-in): Deterministic SHA-256 hashing
  - `qrcode`: Dynamic QR code generator
  - `animejs` & `lenis`: Micro-interactions & smooth scrolling

---

## 📁 Fungsi Direktori & File

```text
src/
├── app/                  # Routing halaman utama & layout (Next.js App Router)
│   ├── api/              # Endpoint backend API
│   │   ├── qr/           # API pembuatan hash ijazah & generate QR code
│   │   └── verify/       # API validasi integritas data & hash
│   ├── verify/           # Halaman publik verifikasi hasil scan QR
│   ├── globals.css       # Style global & konfigurasi tema
│   ├── layout.tsx        # Shell layout utama aplikasi
│   └── page.tsx          # Halaman dashboard penerbitan & generator QR
├── components/           # Komponen UI modular
│   ├── lenis-provider.tsx# Provider smooth-scrolling
│   ├── roll-button.tsx   # Tombol interaktif beranimasi
│   └── theme-toggle.tsx  # Pengalih tema gelap/terang
└── lib/                  # Logika bisnis & modul utilitas
    ├── animations.ts     # Konfigurasi animasi Anime.js
    ├── crypto.ts         # Logika pembuatan cryptographic hash SHA-256
    └── store.ts          # In-memory database (mock store & auto-seed)
```

---

## 🔐 Fungsi Hash & QR Code

### 1. Cryptographic Hash (SHA-256)
- **Fungsi**: Menghasilkan sidik jari digital unik (*checksum* 64 karakter hex) yang deterministik dari data ijazah (Nomor Seri, NIM, Nama Mahasiswa, Tanggal Terbit).
- **Integritas**: Bersifat satu arah dan sensitif (*avalanche effect*). Perubahan 1 karakter saja pada data ijazah akan mengubah total nilai hash, sehingga sistem dapat mendeteksi pemalsuan seketika.

### 2. Dynamic QR Code
- **Fungsi**: Mengonversi tautan verifikasi publik yang memuat nomor seri dan hash ke dalam format gambar QR Code (Level H - koreksi error tinggi hingga 30%).
- **Akses Cepat**: Memungkinkan ijazah fisik maupun digital dipindai secara instan menggunakan kamera *smartphone* untuk mencocokkan data langsung dengan rekaman resmi.

---

## 🗄️ Penyimpanan: Supabase Ledger

Data ijazah disimpan di tabel **append-only berantai hash** (`diploma_ledger`) di Supabase — perilakunya seperti blockchain privat, dan nantinya `entry_hash` bisa di-*anchor* ke blockchain publik.

- Tidak ada UPDATE/DELETE (diblokir trigger). Perubahan data = entri versi baru.
- Tiap entri menyimpan `prev_hash` → mengubah satu baris memutus rantai.
- Hanya server (service role) yang bisa akses; `anon`/`authenticated` diblokir RLS.
- Backend bisa ditukar via `REGISTRY_BACKEND` (`supabase` / `memory`) — lihat [src/lib/registry/](src/lib/registry/).

**Setup:**
1. Buat project di [supabase.com](https://supabase.com).
2. SQL Editor → jalankan [supabase/migrations/0001_diploma_ledger.sql](supabase/migrations/0001_diploma_ledger.sql), lalu (opsional) [supabase/seed.sql](supabase/seed.sql).
3. Salin `.env.example` → `.env.local`, isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
4. `npm run dev`.

Audit integritas rantai: `select * from verify_diploma_ledger();` — hasil kosong = rantai utuh.

---

## 🛡️ DevSecOps CI/CD Pipeline

Panduan dan alur otomatisasi keamanan CI/CD tersedia dalam dua versi:
- ⚡ **[CICD-RINGKAS.md](file:///CICD-RINGKAS.md)**: Ringkasan cepat, poin-poin sederhana, dan perintah wajib lokal.
- 📖 **[CICD.md](file:///CICD.md)**: Dokumentasi teknis lengkap (arsitektur, matriks tools, diagram alur, dan security gates).
- ⚙️ **[.github/workflows/devsecops-pipeline.yml](file:///.github/workflows/devsecops-pipeline.yml)**: Script otomatisasi pipeline GitHub Actions.


