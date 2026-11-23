import "server-only";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseEventLogs,
  recoverMessageAddress,
  toBytes,
  zeroHash,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, polygonAmoy, sepolia } from "viem/chains";
import { diplomaRegistryAbi } from "@/lib/chain/abi";
import { serverEnv } from "@/lib/env";

const KNOWN_CHAINS: Chain[] = [hardhat, sepolia, polygonAmoy];

function resolveChain(): Chain {
  const { CHAIN_ID, RPC_URL } = serverEnv();
  return (
    KNOWN_CHAINS.find((c) => c.id === CHAIN_ID) ??
    defineChain({
      id: CHAIN_ID,
      name: `chain-${CHAIN_ID}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    })
  );
}

function registryAddress(): Address {
  return serverEnv().DIPLOMA_REGISTRY_ADDRESS as Address;
}

let publicClient: ReturnType<typeof createPublicClient> | undefined;
function getPublicClient() {
  publicClient ??= createPublicClient({ chain: resolveChain(), transport: http(serverEnv().RPC_URL) });
  return publicClient;
}

function getRelayerWallet() {
  const env = serverEnv();
  return createWalletClient({
    account: privateKeyToAccount(env.ISSUER_RELAYER_PRIVATE_KEY as Hex),
    chain: resolveChain(),
    transport: http(env.RPC_URL),
  });
}

/** Kunci nomor seri on-chain: keccak256(serial). Nomor seri mentah tetap off-chain. */
export function serialKeyOf(serial: string): Hex {
  return keccak256(toBytes(serial.trim()));
}

export type VerificationStatus = "valid" | "revoked" | "not_found";

export interface VerificationResult {
  status: VerificationStatus;
  serialKey: Hex | null;
  docHash: Hex | null;
  issuedAt: string | null;
  revokedAt: string | null;
  signer: Address | null;
  signerIsCurrentIssuer: boolean;
  registry: Address;
  chainId: number;
}

const STATUS_MAP: Record<number, VerificationStatus> = { 0: "not_found", 1: "valid", 2: "revoked" };

type OnChainDiploma = { docHash: Hex; issuedAt: bigint; revokedAt: bigint; revoked: boolean; signature: Hex };

async function buildResult(statusCode: number, serialKey: Hex, diploma: OnChainDiploma): Promise<VerificationResult> {
  const base = { registry: registryAddress(), chainId: resolveChain().id };
  const status = STATUS_MAP[statusCode] ?? "not_found";
  if (status === "not_found" || serialKey === zeroHash) {
    return {
      ...base,
      status: "not_found",
      serialKey: null,
      docHash: null,
      issuedAt: null,
      revokedAt: null,
      signer: null,
      signerIsCurrentIssuer: false,
    };
  }

  const client = getPublicClient();
  const [digest, currentSigner] = await Promise.all([
    client.readContract({
      address: registryAddress(),
      abi: diplomaRegistryAbi,
      functionName: "issuanceDigest",
      args: [serialKey, diploma.docHash],
    }),
    client.readContract({ address: registryAddress(), abi: diplomaRegistryAbi, functionName: "kmsSigner" }),
  ]);
  const signer = await recoverMessageAddress({ message: { raw: digest }, signature: diploma.signature });

  return {
    ...base,
    status,
    serialKey,
    docHash: diploma.docHash,
    issuedAt: new Date(Number(diploma.issuedAt) * 1000).toISOString(),
    revokedAt: diploma.revoked ? new Date(Number(diploma.revokedAt) * 1000).toISOString() : null,
    signer,
    signerIsCurrentIssuer: signer.toLowerCase() === currentSigner.toLowerCase(),
  };
}

/** Verifikasi berdasarkan hash SHA-256 dokumen (alur unggah PDF). */
export async function verifyByHash(docHash: Hex): Promise<VerificationResult> {
  const [status, serialKey, diploma] = await getPublicClient().readContract({
    address: registryAddress(),
    abi: diplomaRegistryAbi,
    functionName: "getByHash",
    args: [docHash],
  });
  return buildResult(status, serialKey, diploma);
}

/** Verifikasi berdasarkan nomor seri (alur QR code / tautan). */
export async function verifyBySerial(serial: string): Promise<VerificationResult> {
  const serialKey = serialKeyOf(serial);
  const [status, diploma] = await getPublicClient().readContract({
    address: registryAddress(),
    abi: diplomaRegistryAbi,
    functionName: "getBySerial",
    args: [serialKey],
  });
  return buildResult(status, serialKey, diploma);
}

export async function getIssuanceDigest(serialKey: Hex, docHash: Hex): Promise<Hex> {
  return getPublicClient().readContract({
    address: registryAddress(),
    abi: diplomaRegistryAbi,
    functionName: "issuanceDigest",
    args: [serialKey, docHash],
  });
}

export interface ProposalOutcome {
  txHash: Hex;
  proposalId: bigint;
  executed: boolean;
}

async function submit(
  functionName: "proposeIssue" | "proposeRevoke",
  args: readonly [Hex, Hex, Hex] | readonly [Hex],
): Promise<ProposalOutcome> {
  const wallet = getRelayerWallet();
  const client = getPublicClient();
  // simulateContract menangkap revert (mis. AlreadyIssued) sebelum mengirim transaksi.
  const { request } = await client.simulateContract({
    address: registryAddress(),
    abi: diplomaRegistryAbi,
    functionName,
    args,
    account: wallet.account,
  } as never);
  const txHash = await wallet.writeContract(request as never);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`Transaksi gagal: ${txHash}`);

  const logs = parseEventLogs({ abi: diplomaRegistryAbi, logs: receipt.logs });
  const created = logs.find((l) => l.eventName === "ProposalCreated");
  if (!created || created.eventName !== "ProposalCreated") throw new Error("Event ProposalCreated tidak ditemukan");
  const executed = logs.some((l) => l.eventName === "DiplomaIssued" || l.eventName === "DiplomaRevoked");
  return { txHash, proposalId: created.args.proposalId, executed };
}

export function proposeIssue(serialKey: Hex, docHash: Hex, signature: Hex) {
  return submit("proposeIssue", [serialKey, docHash, signature] as const);
}

export function proposeRevoke(serialKey: Hex) {
  return submit("proposeRevoke", [serialKey] as const);
}
