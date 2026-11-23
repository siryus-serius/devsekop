# Security Scan — Sesudah Perbaikan (After)

| Tool | Before | After | Perbaikan |
|---|---|---|---|
| npm audit (semua dependensi) | 38 (11 high, 12 moderate, 15 low) | **29 (0 high, 10 moderate, 19 low)** | `npm audit fix` + `overrides` untuk `lodash` 4.18.1, `tmp` 0.2.7, `serialize-javascript` 7.1.4 |
| npm audit (production) | 1 moderate (`next`) | **0** | `next` 15.5.28 → 15.5.29 |
| Slither | 1 medium + 1 low, gate gagal | **0**, gate lolos | Status disimpan eksplisit, logika tidak lagi bergantung pada `block.timestamp` |
| Gitleaks | 0 | 0 | — |

Sisa 29 temuan low/moderate seluruhnya ada di tooling pengembangan Hardhat 2 (tidak ikut ke image/production). Menghilangkannya butuh upgrade besar ke Hardhat 3.

File: `npm-audit.json`. Bukti pipeline: tab Actions (run sebelum & sesudah perbaikan).
