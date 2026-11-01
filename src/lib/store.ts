import { DiplomaRecord, generateDiplomaHash } from "./crypto";

// Persistent global store across Next.js dev server hot reloads
const globalForStore = globalThis as unknown as {
  diplomaStore?: Map<string, DiplomaRecord>;
};

export const diplomaMap: Map<string, DiplomaRecord> =
  globalForStore.diplomaStore ?? new Map<string, DiplomaRecord>();

if (process.env.NODE_ENV !== "production") {
  globalForStore.diplomaStore = diplomaMap;
}

/**
 * Initialize mock data if store is empty
 */
function initializeStoreWithSeedData() {
  if (diplomaMap.size > 0) return;

  const seeds = [
    {
      serialNumber: "IJZ-2026-CS-001",
      studentId: "123200045",
      studentName: "Budi Santoso",
      issueDate: "2026-08-15",
      major: "Teknik Informatika",
      university: "Universitas Sains & Teknologi Indonesia",
    },
    {
      serialNumber: "IJZ-2026-IS-002",
      studentId: "123200088",
      studentName: "Siti Rahmawati",
      issueDate: "2026-08-15",
      major: "Sistem Informasi",
      university: "Universitas Sains & Teknologi Indonesia",
    },
  ];

  for (const seed of seeds) {
    const hash = generateDiplomaHash(seed);
    const now = new Date().toISOString();
    diplomaMap.set(seed.serialNumber, {
      ...seed,
      hash,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }
}

// Auto-seed on load
initializeStoreWithSeedData();

/**
 * Save a new diploma or update existing one in memory.
 */
export function saveOrUpdateDiploma(
  payload: Omit<DiplomaRecord, "createdAt" | "updatedAt" | "version"> & {
    createdAt?: string;
    updatedAt?: string;
    version?: number;
  }
): DiplomaRecord {
  const existing = diplomaMap.get(payload.serialNumber);
  const now = new Date().toISOString();

  const record: DiplomaRecord = {
    ...payload,
    createdAt: existing?.createdAt ?? payload.createdAt ?? now,
    updatedAt: now,
    version: existing ? (existing.version ?? 1) + 1 : 1,
  };

  diplomaMap.set(payload.serialNumber, record);
  return record;
}

/**
 * Get a diploma by its serial number (case-insensitive lookup helper)
 */
export function getDiplomaBySerial(serialNumber: string): DiplomaRecord | undefined {
  if (!serialNumber) return undefined;
  
  // Exact match
  if (diplomaMap.has(serialNumber)) {
    return diplomaMap.get(serialNumber);
  }

  // Case-insensitive match fallback
  const normalized = serialNumber.trim().toLowerCase();
  for (const [key, record] of diplomaMap.entries()) {
    if (key.toLowerCase() === normalized) {
      return record;
    }
  }

  return undefined;
}

/**
 * Retrieve all diploma records ordered by last updated
 */
export function getAllDiplomas(): DiplomaRecord[] {
  return Array.from(diplomaMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Delete a diploma from the store
 */
export function deleteDiploma(serialNumber: string): boolean {
  return diplomaMap.delete(serialNumber);
}

/**
 * Reset store to initial state (for testing purposes)
 */
export function resetDiplomaStore(): void {
  diplomaMap.clear();
  initializeStoreWithSeedData();
}
