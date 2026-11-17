import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DiplomaRecord } from "@/lib/crypto";
import type { DiplomaRegistry } from "./types";

// Server-only: uses the service-role/secret key. Never import from a client component.

interface CurrentRow {
  serial_number: string;
  version: number;
  payload: {
    studentId: string;
    studentName: string;
    issueDate: string;
    major?: string;
    university?: string;
  };
  record_hash: string;
  prev_hash: string;
  entry_hash: string;
  first_issued_at: string;
  updated_at: string;
}

const COLUMNS =
  "serial_number, version, payload, record_hash, prev_hash, entry_hash, first_issued_at, updated_at";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase registry is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function toRecord(row: CurrentRow): DiplomaRecord {
  return {
    serialNumber: row.serial_number,
    studentId: row.payload.studentId,
    studentName: row.payload.studentName,
    issueDate: row.payload.issueDate,
    major: row.payload.major,
    university: row.payload.university,
    hash: row.record_hash,
    createdAt: row.first_issued_at,
    updatedAt: row.updated_at,
    version: row.version,
    ledger: { entryHash: row.entry_hash, prevHash: row.prev_hash },
  };
}

export const supabaseRegistry: DiplomaRegistry = {
  backend: "supabase",

  async issue(input) {
    const { serialNumber, hash, ...rest } = input;
    const payload = {
      studentId: rest.studentId,
      studentName: rest.studentName,
      issueDate: rest.issueDate,
      ...(rest.major ? { major: rest.major } : {}),
      ...(rest.university ? { university: rest.university } : {}),
    };

    const { error } = await db().rpc("issue_diploma", {
      p_serial_number: serialNumber,
      p_payload: payload,
      p_record_hash: hash,
    });
    if (error) throw new Error(`Ledger write failed: ${error.message}`);

    const record = await this.getBySerial(serialNumber);
    if (!record) throw new Error("Ledger write succeeded but record could not be read back.");
    return record;
  },

  async getBySerial(serialNumber) {
    const key = serialNumber?.trim().toLowerCase();
    if (!key) return undefined;

    const { data, error } = await db()
      .from("diploma_current")
      .select(COLUMNS)
      .eq("serial_key", key)
      .maybeSingle<CurrentRow>();
    if (error) throw new Error(`Ledger read failed: ${error.message}`);
    return data ? toRecord(data) : undefined;
  },

  async list() {
    const { data, error } = await db()
      .from("diploma_current")
      .select(COLUMNS)
      .order("updated_at", { ascending: false })
      .returns<CurrentRow[]>();
    if (error) throw new Error(`Ledger read failed: ${error.message}`);
    return (data ?? []).map(toRecord);
  },
};
