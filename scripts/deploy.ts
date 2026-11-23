/**
 * Deploy DiplomaRegistry.
 *
 *   npm run chain:deploy:local      (Hardhat node lokal)
 *   npm run chain:deploy:sepolia    (butuh SEPOLIA_RPC_URL & DEPLOYER_PRIVATE_KEY)
 *
 * Variabel lingkungan (dibaca dari .env.local):
 *   KMS_ISSUER_SIGNER_KEY       -> alamat signer KMS diturunkan dari kunci ini
 *   ISSUER_RELAYER_PRIVATE_KEY  -> relayer server otomatis menjadi approver
 *   APPROVER_ADDRESSES          -> (opsional) approver tambahan, pisahkan dengan koma
 *   MULTISIG_THRESHOLD          -> jumlah persetujuan minimum (default 2)
 *   REGISTRY_ADMIN_ADDRESS      -> (opsional) admin; di produksi gunakan alamat Safe multisig
 */
import hre from "hardhat";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function requireKey(name: string): Hex {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} belum di-set atau formatnya salah (harus 0x + 64 hex). Jalankan: npm run keys:generate`);
  }
  return value as Hex;
}

async function main() {
  const [deployer, , secondLocalApprover] = await hre.viem.getWalletClients();
  if (!deployer) throw new Error("Tidak ada akun deployer.");

  const kmsSigner = privateKeyToAccount(requireKey("KMS_ISSUER_SIGNER_KEY")).address;
  const relayer = privateKeyToAccount(requireKey("ISSUER_RELAYER_PRIVATE_KEY")).address;

  const extra = (process.env.APPROVER_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      if (!isAddress(a)) throw new Error(`Alamat approver tidak valid: ${a}`);
      return getAddress(a);
    });

  // Di jaringan lokal, akun Hardhat #2 dipakai sebagai approver kedua bila tidak ada yang diberikan.
  const isLocal = hre.network.name === "localhost" || hre.network.name === "hardhat";
  if (extra.length === 0 && isLocal && secondLocalApprover) extra.push(secondLocalApprover.account.address);

  const approvers = [...new Set<Address>([relayer, ...extra])];
  const threshold = Number(process.env.MULTISIG_THRESHOLD ?? 2);
  const admin = (process.env.REGISTRY_ADMIN_ADDRESS as Address | undefined) ?? deployer.account.address;

  if (!isLocal && admin === deployer.account.address) {
    console.warn("⚠️  REGISTRY_ADMIN_ADDRESS tidak di-set: admin = EOA deployer. Gunakan Safe multisig di produksi.");
  }

  const registry = await hre.viem.deployContract("DiplomaRegistry", [admin, approvers, threshold, kmsSigner]);

  // Danai relayer di jaringan lokal agar bisa membayar gas.
  if (isLocal) {
    await deployer.sendTransaction({ to: relayer, value: 10n ** 19n });
  }

  console.log("DiplomaRegistry  :", registry.address);
  console.log("Network          :", hre.network.name);
  console.log("Admin            :", admin);
  console.log("Approvers        :", approvers.join(", "));
  console.log("Threshold        :", threshold);
  console.log("KMS signer       :", kmsSigner);
  console.log(`\nTambahkan ke .env.local:\nDIPLOMA_REGISTRY_ADDRESS=${registry.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
