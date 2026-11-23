import "server-only";
import { createHash } from "node:crypto";
import type { Hex } from "viem";

/** SHA-256 dari isi dokumen, format 0x-hex huruf kecil (sama dengan yang disimpan on-chain). */
export function sha256Hex(data: Uint8Array): Hex {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}
