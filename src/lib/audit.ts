import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Jejak audit (mitigasi STRIDE: Repudiation). Kegagalan logging tidak menggagalkan request. */
export async function audit(entry: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  const { error } = await createSupabaseAdminClient()
    .from("audit_logs")
    .insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    });
  if (error) console.error("[audit] gagal menulis log:", error.message);
}
