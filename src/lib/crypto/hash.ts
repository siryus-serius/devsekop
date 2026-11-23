import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Hex } from "viem";

/** SHA-256 dari isi dokumen, format 0x-hex huruf kecil (sama dengan yang disimpan on-chain). */
export function sha256Hex(data: Uint8Array): Hex {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}

/** HMAC-SHA256 untuk token rahasia (mis. tautan berbagi) agar token mentah tidak disimpan. */
export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
