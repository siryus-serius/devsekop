// Mengekspor ABI DiplomaRegistry dari artefak Hardhat ke src/lib/chain/abi.ts
// sehingga aplikasi Next.js tidak bergantung pada folder artifacts/ (yang di-gitignore).
// CI menjalankan skrip ini dan gagal bila hasilnya berbeda dari file yang di-commit.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const artifactPath = resolve("artifacts/contracts/DiplomaRegistry.sol/DiplomaRegistry.json");
const { abi } = JSON.parse(readFileSync(artifactPath, "utf8"));

const out = `// FILE INI DIHASILKAN OTOMATIS oleh scripts/export-abi.mjs — jangan diedit manual.
export const diplomaRegistryAbi = ${JSON.stringify(abi, null, 2)} as const;
`;

writeFileSync(resolve("src/lib/chain/abi.ts"), out);
console.log("ABI ditulis ke src/lib/chain/abi.ts");
