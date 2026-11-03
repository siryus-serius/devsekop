# Vault Ijazah Digital — Ringkasan Proyek

Dokumentasi ringkas arsitektur direktori, tech stack, serta fungsi keamanan hash dan QR code.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router), React 19
- **Bahasa Pemrograman**: TypeScript, JavaScript
- **Styling**: Tailwind CSS
- **Library Kunci**:
  - `crypto` (Node.js built-in): Deterministic SHA-256 hashing
  - `qrcode`: Dynamic QR code generator
  - `animejs` & `lenis`: UI micro-interactions & smooth scrolling

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
- **Integritas**: Bersifat satu arah dan sensitif (*avalanche effect*). Perubahan sekecil 1 karakter saja pada data ijazah akan mengubah total nilai hash, sehingga sistem dapat mendeteksi pemalsuan data seketika.

### 2. Dynamic QR Code
- **Fungsi**: Mengonversi tautan verifikasi publik yang memuat nomor seri dan hash ke dalam format gambar QR Code (Level H - koreksi error hingga 30%).
- **Akses Cepat**: Memungkinkan ijazah fisik maupun digital dipindai secara instan menggunakan kamera *smartphone* untuk mencocokkan data langsung dengan rekaman resmi.

