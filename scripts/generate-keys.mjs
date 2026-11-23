// Membuat kunci dompet relayer untuk pengembangan / testnet. JANGAN dipakai untuk mainnet.
import { randomBytes } from "node:crypto";

console.log("# Salin ke .env.local (JANGAN di-commit)");
console.log(`ISSUER_RELAYER_PRIVATE_KEY=0x${randomBytes(32).toString("hex")}`);
