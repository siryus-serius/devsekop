/**
 * Approver kedua menyetujui proposal penerbitan/pencabutan (multi-sig).
 *
 *   PROPOSAL_ID=1 npx hardhat run scripts/approve.ts --network localhost
 *
 * Di jaringan lokal memakai akun Hardhat #2. Di jaringan lain set APPROVER_PRIVATE_KEY
 * (di produksi, persetujuan sebaiknya dilakukan via dompet hardware / Safe, bukan skrip).
 */
import hre from "hardhat";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const registryAddress = process.env.DIPLOMA_REGISTRY_ADDRESS as Address | undefined;
  const proposalId = process.env.PROPOSAL_ID;
  if (!registryAddress || !proposalId) throw new Error("Set DIPLOMA_REGISTRY_ADDRESS dan PROPOSAL_ID.");

  const wallets = await hre.viem.getWalletClients();
  const approverKey = process.env.APPROVER_PRIVATE_KEY as Hex | undefined;
  const wallet = approverKey
    ? await hre.viem.getWalletClient(privateKeyToAccount(approverKey).address)
    : wallets[2];
  if (!wallet) throw new Error("Akun approver tidak ditemukan.");

  const registry = await hre.viem.getContractAt("DiplomaRegistry", registryAddress, { client: { wallet } });
  const hash = await registry.write.approve([BigInt(proposalId)]);
  const publicClient = await hre.viem.getPublicClient();
  await publicClient.waitForTransactionReceipt({ hash });

  const proposal = await registry.read.getProposal([BigInt(proposalId)]);
  console.log(`Proposal #${proposalId} disetujui oleh ${wallet.account.address}`);
  console.log(`Persetujuan: ${proposal.approvals} | Dieksekusi: ${proposal.executed}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
