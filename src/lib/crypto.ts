import { createHash } from "crypto";

/**
 * Metadata payload for a diploma certificate.
 * Core fields used for deterministic cryptographic hashing:
 * - serialNumber
 * - studentId (NIM)
 * - studentName
 * - issueDate (YYYY-MM-DD)
 */
export interface DiplomaPayload {
  serialNumber: string;
  studentId: string;
  studentName: string;
  issueDate: string;
  major?: string;
  university?: string;
}

/**
 * Complete diploma record saved in store
 */
export interface DiplomaRecord extends DiplomaPayload {
  hash: string;
  qrCodeUrl?: string;
  verifyUrl?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Computes a deterministic SHA-256 hash from diploma payload.
 * Normalizes strings by trimming to prevent accidental whitespace discrepancies.
 * Canonical format: `${serialNumber}|${studentId}|${studentName}|${issueDate}`
 */
export function generateDiplomaHash(data: DiplomaPayload): string {
  if (!data.serialNumber || !data.studentId || !data.studentName || !data.issueDate) {
    throw new Error("Missing required fields for diploma hash computation (serialNumber, studentId, studentName, issueDate).");
  }

  const normalized = [
    data.serialNumber.trim(),
    data.studentId.trim(),
    data.studentName.trim(),
    data.issueDate.trim(),
  ].join("|");

  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Verifies whether a provided hash matches the computed hash from payload.
 */
export function verifyDiplomaHash(data: DiplomaPayload, expectedHash: string): boolean {
  if (!expectedHash) return false;
  try {
    const computed = generateDiplomaHash(data);
    return computed.toLowerCase() === expectedHash.trim().toLowerCase();
  } catch {
    return false;
  }
}
