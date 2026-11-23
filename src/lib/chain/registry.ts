import "server-only";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  toBytes,
  zeroHash,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";
import { diplomaRegistryAbi } from "@/lib/chain/abi";
import { serverEnv } from "@/lib/env";

const KNOWN_CHAINS: Chain[] = [hardhat, baseSepolia];

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

/** Dompet server (relayer) yang memegang ISSUER_ROLE dan membayar gas. */
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

/** Link block explorer untuk transaksi (kosong bila jaringan lokal). */
export function explorerTxUrl(txHash: string): string | null {
  const explorer = resolveChain().blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${txHash}` : null;
}

// ---------------------------------------------------------------------------
// Baca (gratis, tanpa gas)
// ---------------------------------------------------------------------------

export type VerificationStatus = "valid" | "revoked" | "not_found";

export interface VerificationResult {
  status: VerificationStatus;
  serialKey: Hex | null;
  docHash: Hex | null;
  issuedAt: string | null;
  revokedAt: string | null;
  registry: Address;
  chainId: number;
}

const STATUS_MAP: Record<number, VerificationStatus> = { 0: "not_found", 1: "valid", 2: "revoked" };

type OnChainDiploma = { docHash: Hex; issuedAt: bigint; revokedAt: bigint };

const toIso = (seconds: bigint) => (seconds === 0n ? null : new Date(Number(seconds) * 1000).toISOString());

function buildResult(statusCode: number, serialKey: Hex, diploma: OnChainDiploma): VerificationResult {
  const status = STATUS_MAP[statusCode] ?? "not_found";
  const found = status !== "not_found" && serialKey !== zeroHash;
  return {
    status: found ? status : "not_found",
    serialKey: found ? serialKey : null,
    docHash: found ? diploma.docHash : null,
    issuedAt: found ? toIso(diploma.issuedAt) : null,
    revokedAt: found ? toIso(diploma.revokedAt) : null,
    registry: registryAddress(),
    chainId: resolveChain().id,
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

// ---------------------------------------------------------------------------
// Tulis (dikirim oleh relayer, butuh gas)
// ---------------------------------------------------------------------------

async function send(functionName: "issue" | "revoke", args: readonly [Hex, Hex] | readonly [Hex]): Promise<Hex> {
  const wallet = getRelayerWallet();
  const client = getPublicClient();
  // Simulasi dulu: bila akan gagal (mis. AlreadyIssued), berhenti sebelum gas terpakai.
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
  return txHash;
}

/** Mencatat ijazah ke blockchain. Mengembalikan tx hash. */
export function issueOnChain(serialKey: Hex, docHash: Hex) {
  return send("issue", [serialKey, docHash] as const);
}

/** Mencabut ijazah di blockchain. Mengembalikan tx hash. */
export function revokeOnChain(serialKey: Hex) {
  return send("revoke", [serialKey] as const);
}
