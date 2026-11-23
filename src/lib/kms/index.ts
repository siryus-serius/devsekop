import "server-only";
import type { Address, Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { aesGcmDecrypt, aesGcmEncrypt, randomKey } from "@/lib/crypto/aes";
import { serverEnv } from "@/lib/env";

/**
 * Antarmuka Key Management Service (REQ-04).
 * Kode aplikasi HANYA bergantung pada antarmuka ini; kunci privat tidak pernah keluar.
 * Implementasi produksi dapat diganti ke AWS KMS / GCP Cloud KMS / Azure Key Vault /
 * HashiCorp Vault Transit / HSM PKCS#11 tanpa mengubah kode pemanggil.
 */
export interface KeyManagementService {
  /** Membuat Data Encryption Key (DEK) baru: plaintext dipakai sekali, wrapped disimpan di DB. */
  generateDataKey(context: string): Promise<{ plaintext: Buffer; wrapped: string }>;
  unwrapDataKey(wrapped: string, context: string): Promise<Buffer>;
  /** Enkripsi field PII kecil (NIK, IPK) dengan kunci master (envelope sederhana). */
  encryptField(value: string, context: string): Promise<string>;
  decryptField(ciphertext: string, context: string): Promise<string>;
  /** Tanda tangan EIP-191 atas digest 32 byte dengan kunci issuer. */
  signDigest(digest: Hex): Promise<Hex>;
  signerAddress(): Address;
}

/**
 * SIMULASI HSM untuk pengembangan. Kunci dimuat dari environment dan disimpan
 * dalam closure privat (tidak dapat diakses/diekspor dari luar modul).
 * ⚠️ Tidak setara HSM sungguhan: di produksi ganti dengan KMS terkelola.
 */
class SimulatedKms implements KeyManagementService {
  readonly #masterKey: Buffer;
  readonly #signer: PrivateKeyAccount;

  constructor(masterKeyB64: string, signerKey: Hex) {
    this.#masterKey = Buffer.from(masterKeyB64, "base64");
    this.#signer = privateKeyToAccount(signerKey);
  }

  async generateDataKey(context: string) {
    const plaintext = randomKey();
    const wrapped = aesGcmEncrypt(this.#masterKey, plaintext, `dek:${context}`).toString("base64");
    return { plaintext, wrapped };
  }

  async unwrapDataKey(wrapped: string, context: string) {
    return aesGcmDecrypt(this.#masterKey, Buffer.from(wrapped, "base64"), `dek:${context}`);
  }

  async encryptField(value: string, context: string) {
    return aesGcmEncrypt(this.#masterKey, Buffer.from(value, "utf8"), `field:${context}`).toString("base64");
  }

  async decryptField(ciphertext: string, context: string) {
    return aesGcmDecrypt(this.#masterKey, Buffer.from(ciphertext, "base64"), `field:${context}`).toString("utf8");
  }

  async signDigest(digest: Hex) {
    return this.#signer.signMessage({ message: { raw: digest } });
  }

  signerAddress() {
    return this.#signer.address;
  }
}

let instance: KeyManagementService | undefined;

export function kms(): KeyManagementService {
  if (!instance) {
    const env = serverEnv();
    instance = new SimulatedKms(env.KMS_MASTER_KEY, env.KMS_ISSUER_SIGNER_KEY as Hex);
  }
  return instance;
}
