# Baseline Security Scan (Before)

Tanggal scan: 24 November 2026
Kondisi: setelah penyederhanaan arsitektur, **sebelum** perbaikan keamanan lanjutan.

| Tool | Kategori | Target | Hasil | File |
|---|---|---|---|---|
| npm audit | SCA | Semua dependensi | **38 kerentanan**: 0 critical, 11 high, 12 moderate, 15 low | `npm-audit.json` |
| npm audit `--omit=dev` | SCA | Dependensi production | 1 moderate (`next`) | — |
| Gitleaks `git` | Secrets | Riwayat commit | 0 temuan | `gitleaks-history.json` |
| Gitleaks `--pre-commit` | Secrets | Perubahan belum di-commit | 0 temuan | `gitleaks-uncommitted.json` |
| Semgrep | SAST aplikasi | `src/` | Dijalankan di GitHub Actions | tab Security (SARIF) |
| Slither | SAST kontrak | `contracts/` | **2 temuan**: 1 medium (`incorrect-equality`), 1 low (`timestamp`). Gate memblokir | `slither.txt` |

## Catatan

- 11 temuan **high** berasal dari tooling pengembangan (Hardhat, `hardhat-toolbox-viem`, `undici`, `lodash`, `tmp`, `adm-zip`, `serialize-javascript`, `@fastify/busboy`). Paket ini tidak ikut ke bundle production.
- Secret asli hanya ada di `.env.local` yang di-gitignore dan tidak pernah masuk riwayat git.
- Semgrep, Slither, Trivy, dan Checkov tidak dijalankan lokal: Semgrep/Slither butuh Python, dan `trivy.exe` diblokir Windows Application Control di laptop pengembang. Keempatnya dijalankan di pipeline CI.

## Rencana perbaikan (After)

1. Upgrade dependensi rentan (`npm audit fix`, upgrade `next`), lalu scan ulang.
2. Tambah Trivy (dependensi + image) dan Checkov (Dockerfile + workflow) di CI.
3. Tambah OWASP ZAP terhadap Vercel Preview.
