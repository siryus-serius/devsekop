# Rangkuman Progres Proyek

**Proyek:** Aplikasi Vault Dokumen dan Sertifikat Digital Berbasis Web (Ijazah Digital Berbasis Blockchain)
**Repositori:** `github.com/siryus-serius/devsekop`
**Per tanggal:** 24 November 2026

---

## 1. Ringkasan Singkat

Kampus mengunggah PDF ijazah, sistem mencatat sidik jari SHA-256-nya di blockchain, dan siapa pun bisa mengecek keasliannya tanpa login. Data ijazah yang dipakai **fiktif** untuk keperluan demo.

Karena sekitar 70% bobot rubrik ada di pipeline, infrastruktur, dan observabilitas, aplikasi sengaja dibuat sekecil mungkin. Fokus pengerjaan dipindahkan ke keamanan dan otomatisasi.

---

## 2. Penyederhanaan yang Sudah Dilakukan

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Halaman & API | 13 (termasuk vault alumni dan share link) | 4 halaman + 5 API |
| Tabel database | 5 tabel, 3 peran, 5 status | 3 tabel, 2 peran, 2 status |
| Smart contract | ±230 baris, multisig + tanda tangan KMS | ±80 baris, `AccessControl` dua peran |
| Enkripsi | AES envelope + simulasi KMS | Storage privat Supabase (terenkripsi at rest) |
| Data pribadi | NIK, IPK, email alumni | Hanya nama, NIM, prodi, tanggal lulus |
| Pemindai malware | ClamAV (butuh server terpisah) | Validasi struktur PDF |
| SAST di CI | Mythril (±30 menit) + CodeQL | Semgrep + Slither |

**Halaman:** Beranda, Login + MFA, Dasbor Kampus, Verifikasi (`/verify` dan `/verify/[serial]`).
**API:** terbitkan, cabut, unduh PDF, verifikasi, health check.

---

## 3. Arsitektur

```
 Verifier ──┐                                   ┌──► Supabase (off-chain)
            ├──► Vercel ──► Next.js (UI + API) ─┤      ├─ Auth + MFA
 Staf ──────┘    Firewall    Middleware: CSP,   │      ├─ Postgres + RLS (metadata, audit_logs)
                             sesi, MFA, CSRF    │      └─ Storage privat (PDF)
                                                │
                                                └──► Blockchain EVM (on-chain)
                                                       └─ DiplomaRegistry: hash + status
```

| Lingkungan | Isi | Fungsi |
|---|---|---|
| Production | Vercel + Supabase Cloud + Base Sepolia (testnet) | Demo |
| Container | Image Docker dari aplikasi yang sama | Container scanning, IaC scanning, self-host |
| Lokal | Hardhat node + Supabase lokal | Pengembangan dan unit test |

---

## 4. Skema Blockchain

**Kontrak:** `contracts/DiplomaRegistry.sol`

| Peran on-chain | Dipegang oleh | Hak |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Dompet admin kampus | Memberi / mencabut peran |
| `ISSUER_ROLE` | Dompet server (relayer) | `issue` dan `revoke` |

| Fungsi | Keterangan |
|---|---|
| `issue(serialKey, docHash)` | Tolak nilai kosong, nomor seri ganda, dan PDF ganda |
| `revoke(serialKey)` | Status menjadi DICABUT, catatan terbit tetap ada |
| `getBySerial`, `getByHash` | Baca gratis tanpa gas, dipakai halaman verifikasi |

**Yang disimpan on-chain:** status (`NotFound` / `Valid` / `Revoked`), hash SHA-256 PDF, `keccak256(nomor seri)`, waktu terbit, dan waktu cabut. Tidak ada data pribadi.

**Respon insiden:** bila kunci relayer bocor, admin mencabut `ISSUER_ROLE` dari alamat lama. Skenario ini sudah diuji di unit test.

**Unit test:** 13 skenario (penerbitan, verifikasi, pencabutan, kontrol akses, respon insiden). Semua lolos.

---

## 5. Skema Penyimpanan

```
Staf mengisi form + unggah PDF "DEMO-2026-0001"
│
├─► Supabase Storage (bucket privat)  : file PDF asli
├─► Blockchain                        : hash PDF + status + waktu
└─► Supabase Postgres
      diplomas   : nama, NIM, prodi, tanggal lulus, lokasi file, hash, tx hash, status
      audit_logs : siapa melakukan apa, dari IP mana, kapan, level info/warning/critical
```

| Tabel | Isi | Yang bisa membaca |
|---|---|---|
| `profiles` | Akun staf + peran (kosong = tanpa akses) | Diri sendiri, admin |
| `diplomas` | Metadata ijazah + bukti on-chain | Staf yang sudah MFA |
| `audit_logs` | Kejadian & kejadian keamanan | Admin |

**Prinsip:**
1. Blockchain adalah sumber kebenaran. Database hanya katalog.
2. Pengguna tidak bisa menulis ke database. Semua penulisan lewat API server setelah cek peran dan MFA.
3. PDF milik verifier di-hash di browser dan tidak pernah dikirim ke server.
4. Akun baru tidak punya peran sampai admin memberikannya (*deny by default*).

---

## 6. Pipeline CI/CD

Berjalan setiap *push* dan *pull request* ke `main`. Job berjalan paralel.

| Job | Tool | Gagal bila |
|---|---|---|
| App | `tsc`, `next build`, cek ABI sinkron | Error build / type |
| Contracts | Hardhat test | Test gagal |
| SAST kontrak | Slither | Temuan ≥ medium |
| SAST aplikasi | Semgrep (OWASP Top 10) | Temuan severity ERROR |
| SCA | `npm audit`, dependency review | Kerentanan ≥ high |
| Secrets | Gitleaks (seluruh riwayat git) | Secret terdeteksi |
| Container | Docker build + Trivy, lalu push ke GHCR | CVE HIGH/CRITICAL yang sudah ada perbaikannya |
| IaC | Checkov (Dockerfile + GitHub Actions) | Ada pemeriksaan yang gagal |
| **Security gate** | — | Salah satu job di atas gagal |

**Durasi pipeline terakhir yang lolos:** 87 detik (sebelum job Container dan IaC ditambahkan).

---

## 7. Bukti Before vs After

| Aspek | Before | After | Perbaikan |
|---|---|---|---|
| SCA, semua dependensi | 38 kerentanan (11 high) | 29 kerentanan (**0 high**) | `npm audit fix` + `overrides` untuk `lodash`, `tmp`, `serialize-javascript` |
| SCA, production | 1 moderate (`next`) | **0** | `next` 15.5.28 → 15.5.29 |
| SAST kontrak (Slither) | 1 medium + 1 low, gate gagal | **0**, gate lolos | Status disimpan eksplisit, logika tidak lagi bergantung pada `block.timestamp` |
| Secrets (Gitleaks) | 0 | 0 | — |
| Pipeline | 5 job gagal | **7/7 job lolos** | Node 24 di CI, kompilasi sebelum Slither, Gitleaks CLI |

**Run pipeline sebagai bukti (tab Actions):**

| Kondisi | Commit | Hasil |
|---|---|---|
| Before | `3eb411d` ci: kompilasi kontrak sebelum Slither | Slither gagal (temuan medium), gate memblokir |
| After | `436ed34` fix(contract): simpan status eksplisit… | Semua job lolos |

Laporan mentah: `reports/baseline/` (before) dan `reports/after/` (after).

---

## 8. Masalah yang Ditemui & Solusinya

| Masalah | Penyebab | Solusi |
|---|---|---|
| `npm ci` gagal di CI | CI memakai npm 10, lockfile dibuat npm 11 (`Missing: zod@3.25.76`) | CI dipindah ke Node 24 |
| Gitleaks gagal di CI | Riwayat `main` tertimpa *force push*, rentang commit tidak ditemukan | Ganti ke Gitleaks CLI yang memindai seluruh riwayat |
| Slither gagal instalasi | Container Slither memasang npm sendiri dan menolak install script | Kompilasi Hardhat dilakukan sebelum Slither (`ignore-compile`) |
| Slither menemukan isu di kontrak | Logika "ijazah ada" memakai `issuedAt == 0` | Status disimpan di mapping terpisah |
| Trivy tidak bisa jalan di laptop | Diblokir Windows Application Control | Dijalankan di CI |

> **Catatan tim:** jangan memakai `git push --force` ke `main`. Commit lama (`ad10dee`, `2b607ac`) sempat tertimpa.

---

## 9. Status Rubrik (Perkiraan)

| Aspek | Bobot | Status | Skor | Yang kurang |
|---|---:|---|:---:|---|
| Application Design | 5% | ✅ Arsitektur + README | 4 | Dokumen formal per tahap SDLC |
| Threat Modeling | 10% | ✅ STRIDE + OWASP | 3 | Diagram OWASP Threat Dragon |
| SAST | 10% | ✅ Semgrep + Slither, ada before/after | 5 | — |
| SCA | 8% | ✅ npm audit + dependency review, ada before/after | 5 | — |
| Secrets | 7% | ✅ Gitleaks seluruh riwayat | 4 | Pre-commit hook |
| Container Scanning | 5% | 🟡 Dockerfile + Trivy dibuat | 3 | Hasil CI + before/after |
| IaC Security | 5% | 🟡 Checkov dibuat | 3 | Hasil CI + before/after |
| Network & Cloud | 10% | 🟡 CSP, header, RLS, rate limit | 3 | Vercel Firewall + dokumentasi |
| Quality Gate & Fail-Fast | 10% | ✅ Gate terbukti memblokir | 4 | Gate memblokir deploy production |
| DAST | 10% | ❌ | 1 | OWASP ZAP pada Vercel Preview |
| Pipeline Efficiency | 5% | ✅ Paralel + cache, 87 detik | 4 | — |
| Logging & SIEM | 10% | 🟡 `audit_logs` + log JSON | 2 | Dashboard Grafana |
| Monitoring & Alert | 10% | ❌ | 1 | Alert Grafana → Discord |
| Incident Response | 5% | 🟡 Rotasi kunci teruji, `/api/health` | 2 | SOP + rollback otomatis |

---

## 10. Langkah Berikutnya

1. Push Dockerfile, Trivy, Checkov, lalu perbaiki temuannya (before/after).
2. OWASP ZAP terhadap Vercel Preview + gate yang memblokir deploy production.
3. Grafana Cloud: dashboard dari `audit_logs` dan alert ke Discord/email.
4. SOP respon insiden + rollback otomatis memakai `/api/health`.
5. Diagram OWASP Threat Dragon.
6. Script pembuat PDF ijazah fiktif untuk demo.

---

## 11. Cara Menjalankan

Lihat `README.md` bagian **Menjalankan Secara Lokal**.

| Perintah | Fungsi |
|---|---|
| `npm run contracts:test` | Unit test smart contract |
| `npm run typecheck` | Type check |
| `npm run chain:deploy:local` | Deploy kontrak ke Hardhat lokal |
| `npm run chain:deploy:testnet` | Deploy kontrak ke Base Sepolia |
| `npm run dev` | Menjalankan aplikasi |
