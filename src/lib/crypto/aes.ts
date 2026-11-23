import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM (authenticated encryption).
 * Format paket: [versi 1B][IV 12B][auth tag 16B][ciphertext]
 * AAD mengikat ciphertext ke konteksnya (mis. nomor seri) sehingga objek terenkripsi
 * tidak bisa ditukar antar-ijazah tanpa terdeteksi.
 */
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function assertKey(key: Uint8Array) {
  if (key.length !== KEY_LEN) throw new Error("Kunci AES-256 harus 32 byte");
}

export function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array, aad: string): Buffer {
  assertKey(key);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LEN });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext]);
}

export function aesGcmDecrypt(key: Uint8Array, packed: Uint8Array, aad: string): Buffer {
  assertKey(key);
  const buf = Buffer.from(packed);
  if (buf.length < 1 + IV_LEN + TAG_LEN || buf[0] !== VERSION) {
    throw new Error("Format ciphertext tidak dikenali");
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LEN });
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function randomKey(): Buffer {
  return randomBytes(KEY_LEN);
}
