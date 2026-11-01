# 🎓 Digital Diploma Vault — Phase-1 Implementation
> **Deterministic SHA-256 Hashing, Dynamic QR Code Engine & Integrity Verification**

Aplikasi web prototipe ringan (Phase-1) untuk penerbitan dan verifikasi integritas ijazah digital tanpa ketergantungan blockchain, smart contract, Web3, ataupun database cloud eksternal.

---

## 📌 Fitur Utama Phase-1

1. **Deterministic SHA-256 Cryptographic Hashing**:
   - Menghasilkan sidik jari digital 256-bit (64 karakter hex) yang konsisten dan kanonikal dari metadata ijazah: `serialNumber`, `studentId`, `studentName`, `issueDate`.
   - Perubahan 1 karakter pada data akan mengubah hash secara radikal (*avalanche effect*).

2. **Dynamic QR Code Engine**:
   - Menghasilkan QR Code resolusi tinggi (512x512 Data URL Base64) dengan tingkat koreksi kesalahan **Level H (High - 30% redundancy)**.
   - Menyematkan tautan verifikasi otomatis: `${BASE_URL}/verify?serial=${serialNumber}&hash=${hash}`.

3. **In-Memory Store (Mock Repository)**:
   - Menyimpan dan memperbarui rekaman ijazah di memori lokal.
   - Dipreservasi pada `globalThis` agar data tidak hilang saat *hot reload* di lingkungan Next.js.
   - Sudah ter-seed dengan data awal untuk pengujian instan.

4. **Portal Verifikasi Publik (Read-Only)**:
   - Membaca parameter query URL secara otomatis.
   - Membandingkan hash yang disertakan dari QR code dengan hash rekaman resmi.
   - Indikator Status:
     - 🟢 **Badge Hijau**: `"IJAZAH ASLI & TERVERIFIKASI"` (Integritas 100% terjaga).
     - 🔴 **Badge Merah**: `"DATA TIDAK COCOK / TELAH DIMODIFIKASI"` (Terdeteksi perubahan data / pemalsuan).
     - 🟡 **Badge Kuning**: `"NOMOR SERI TIDAK DITEMUKAN"`.
   - Fitur **Uji Simulasi Pemalsuan (Tamper Test)** untuk menguji respons sistem ketika hash dimodifikasi.

---

## 🗂️ Struktur File

```
d:/main folder/devsecop pengembangan/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── qr/
│   │   │   │   └── route.ts         # POST: generate/regenerate hash & QR; GET: list store
│   │   │   └── verify/
│   │   │       └── route.ts         # GET: verifikasi integritas hash
│   │   ├── verify/
│   │   │   └── page.tsx             # Halaman publik verifikasi (status badges & audit)
│   │   ├── globals.css              # Glassmorphism & styling Tailwind v4
│   │   ├── layout.tsx               # Header, navigasi, dan ambient lighting
│   │   └── page.tsx                 # Dashboard penerbit, QR generator, & tester
│   └── lib/
│       ├── crypto.ts                # SHA-256 deterministic hashing logic
│       └── store.ts                 # In-memory mock database & auto-seed
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## 🚀 Cara Menjalankan

```bash
# 1. Pindah ke direktori proyek
cd "d:\main folder\devsecop pengembangan"

# 2. Instal dependensi (sudah terinstal)
npm install

# 3. Jalankan development server
npm run dev

# 4. Buka di browser
# http://localhost:3000
```

---

## 🧪 Skenario Pengujian

1. **Uji Valid (Asli)**:
   - Di halaman utama (`/`), pilih preset **Demo 1 (Budi - TI)** lalu klik **Generate QR Code**.
   - Klik tombol hijau **"UJI HALAMAN VERIFIKASI (VALID)"**.
   - Halaman `/verify` akan menampilkan **Badge Hijau ("IJAZAH ASLI & TERVERIFIKASI")** dengan rincian data lengkap.

2. **Uji Pemalsuan (Tampered)**:
   - Dari dashboard yang sama, klik **"⚠️ Uji Simulasi Pemalsuan (Cek Red Badge)"**.
   - Halaman `/verify` akan menerima hash yang telah dimodifikasi dan menampilkan **Badge Merah ("DATA TIDAK COCOK / TELAH DIMODIFIKASI")**.

3. **Uji Regenerasi**:
   - Ubah salah satu data (misal Tanggal Terbit atau Nama Mahasiswa) lalu klik **Regenerate**.
   - QR code dan SHA-256 hash baru akan dihitung dan diperbarui secara *real-time*.
