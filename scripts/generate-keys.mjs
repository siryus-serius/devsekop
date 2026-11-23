// Menghasilkan material kunci untuk pengembangan lokal. JANGAN gunakan untuk produksi:
// di produksi kunci harus dibuat dan disimpan di dalam HSM/KMS dan tidak pernah diekspor.
import { randomBytes } from "node:crypto";

const hex32 = () => `0x${randomBytes(32).toString("hex")}`;

console.log("# Salin ke .env.local (JANGAN di-commit)");
console.log(`KMS_MASTER_KEY=${randomBytes(32).toString("base64")}`);
console.log(`KMS_ISSUER_SIGNER_KEY=${hex32()}`);
console.log(`ISSUER_RELAYER_PRIVATE_KEY=${hex32()}`);
console.log(`SHARE_TOKEN_PEPPER=${randomBytes(32).toString("base64")}`);
