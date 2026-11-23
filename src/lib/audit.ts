import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditLevel = "info" | "warning" | "critical";

/**
 * Jejak audit & kejadian keamanan. Ditulis ke tabel audit_logs (dibaca Grafana)
 * dan ke stdout sebagai JSON (tampil di log Vercel). Kegagalan logging tidak
 * menggagalkan request.
 */
export async function audit(entry: {
  action: string;
  level?: AuditLevel;
  actorId?: string | null;
  targetId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}) {
  const row = {
    level: entry.level ?? "info",
    action: entry.action,
    actor_id: entry.actorId ?? null,
    target_id: entry.targetId ?? null,
    ip: entry.ip ?? null,
    metadata: entry.metadata ?? {},
  };
  console.log(JSON.stringify({ type: "audit", time: new Date().toISOString(), ...row }));

  const { error } = await createSupabaseAdminClient().from("audit_logs").insert(row);
  if (error) console.error(JSON.stringify({ type: "audit_error", message: error.message }));
}
