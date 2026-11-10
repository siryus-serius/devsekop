# ⚡ Ringkasan Cepat CI/CD DevSecOps
### Proyek: Vault Ijazah Digital

Dokumen ini menjelaskan alur **CI/CD (Continuous Integration & Continuous Deployment)** dengan bahasa yang simpel dan to-the-point.

---

## 🎯 Tujuan Utama
1. **Otomatisasi**: Menguji dan mem-build aplikasi otomatis setiap ada kode baru.
2. **Keamanan (DevSecOps)**: Menolak kode jika ada celah keamanan atau kunci rahasia yang bocor.
3. **Integritas Ijazah**: Memastikan rumus hash SHA-256 dan validasi QR Code tetap aman tanpa bug.

---

## 🔄 6 Langkah Alur CI/CD

```
[ Developer Push Kode ]
          ↓
 1. 🔍 Cek TypeScript & Kode  → Pastikan tidak ada salah ketik / tipe data error.
          ↓
 2. 🔑 Scan Secret (Gitleaks) → Cek jangan sampai ada API key / password yang ter-upload.
          ↓
 3. 📦 Cek Paket (npm audit)  → Scan pustaka luar (dependencies) dari celah virus/CVE.
          ↓
 4. 🛡️ Scan Keamanan (Semgrep)→ Cek logika kode apakah ada celah hacker (OWASP Top 10).
          ↓
 5. 🏗️ Build Aplikasi        → Kompilasi Next.js untuk siap dijalankan di server.
          ↓
 6. 🚀 Deploy Otomatis        → Kirim aplikasi baru ke server publik jika semua tahap lolos.
```

---

## 🚦 Aturan Lolos / Tolak (Security Gate)

| Kondisi | Status | Tindakan |
| :--- | :---: | :--- |
| **Kunci/Token API Bocor** | ❌ Gagal | Pull Request **langsung diblokir** |
| **TypeScript / Build Error** | ❌ Gagal | Wajib diperbaiki oleh pembuat kode |
| **Ada Celah Keamanan Kritis (Critical/High)** | ❌ Gagal | Deployment **dibatalkan** |
| **Semua Tes Hijau / Aman** | ✅ Lolos | Kode otomatis dimerge dan dideploy |

---

## 💻 3 Perintah Wajib Sebelum Push (Cek Lokal)

Jalankan perintah ini di terminal laptop sebelum melakukan `git push`:

```bash
# 1. Cek error tipe data TypeScript
npm run typecheck

# 2. Cek apakah ada paket dependensi yang rentan
npm audit

# 3. Tes build aplikasi
npm run build
```

> **Catatan**: Jika 3 perintah di atas lolos tanpa error di laptop Anda, maka pipeline di GitHub 99% akan lolos dengan lancar.

---

## 📁 File Penting
- **Dokumentasi Lengkap**: [`CICD.md`](file:///CICD.md) *(penjelasan teknis mendalam & arsitektur)*
- **Script Otomatisasi GitHub Actions**: [`.github/workflows/devsecops-pipeline.yml`](file:///.github/workflows/devsecops-pipeline.yml)

