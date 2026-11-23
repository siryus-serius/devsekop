/**
 * Deploy DiplomaRegistry.
 *
 *   npm run chain:deploy:local     (Hardhat node lokal)
 *   npm run chain:deploy:testnet   (Base Sepolia, butuh BASE_SEPOLIA_RPC_URL & DEPLOYER_PRIVATE_KEY)
 *
 * Peran:
 *   admin  = REGISTRY_ADMIN_ADDRESS, atau akun deployer bila kosong
 *   issuer = alamat dari ISSUER_RELAYER_PRIVATE_KEY (dompet server yang mengirim transaksi)
 */
import hre from "hardhat";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const relayerKey = process.env.ISSUER_RELAYER_PRIVATE_KEY;
  if (!relayerKey || !/^0x[0-9a-fA-F]{64}$/.test(relayerKey)) {
    throw new Error("ISSUER_RELAYER_PRIVATE_KEY belum di-set (0x + 64 hex). Jalankan: npm run keys:generate");
  }

  const [deployer] = await hre.viem.getWalletClients();
  if (!deployer) throw new Error("Tidak ada akun deployer.");

  const issuer = privateKeyToAccount(relayerKey as Hex).address;
  const admin = (process.env.REGISTRY_ADMIN_ADDRESS as Address | undefined) || deployer.account.address;

  const registry = await hre.viem.deployContract("DiplomaRegistry", [admin, issuer]);

  // Di jaringan lokal, isi saldo relayer agar bisa membayar gas.
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    await deployer.sendTransaction({ to: issuer, value: 10n ** 19n });
  }

  console.log("Network          :", hre.network.name);
  console.log("DiplomaRegistry  :", registry.address);
  console.log("Admin            :", admin);
  console.log("Issuer (relayer) :", issuer);
  console.log(`\nTambahkan ke .env.local:\nDIPLOMA_REGISTRY_ADDRESS=${registry.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
