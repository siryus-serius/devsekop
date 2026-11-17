import type { DiplomaPayload, DiplomaRecord } from "@/lib/crypto";

export type RegistryBackend = "memory" | "supabase";

/**
 * Storage contract for diploma records. Swap implementations
 * (memory → Supabase → blockchain) without touching the API routes.
 */
export interface DiplomaRegistry {
  readonly backend: RegistryBackend;
  /** Append a new version (or return the latest one if data is unchanged). */
  issue(input: DiplomaPayload & { hash: string }): Promise<DiplomaRecord>;
  /** Latest version by serial number (case-insensitive). */
  getBySerial(serialNumber: string): Promise<DiplomaRecord | undefined>;
  /** Latest version of every diploma, most recently updated first. */
  list(): Promise<DiplomaRecord[]>;
}
