import { memoryRegistry } from "./memory";
import { supabaseRegistry } from "./supabase";
import type { DiplomaRegistry } from "./types";

export type { DiplomaRegistry, RegistryBackend } from "./types";

/**
 * REGISTRY_BACKEND=supabase|memory.
 * Default: supabase when SUPABASE_URL is set, otherwise memory.
 */
export function getRegistry(): DiplomaRegistry {
  const selected =
    process.env.REGISTRY_BACKEND ?? (process.env.SUPABASE_URL ? "supabase" : "memory");

  if (selected === "supabase") return supabaseRegistry;
  if (selected === "memory") return memoryRegistry;
  throw new Error(`Unknown REGISTRY_BACKEND "${selected}" (expected "supabase" or "memory").`);
}
