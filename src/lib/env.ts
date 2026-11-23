import "server-only";
import { z } from "zod";

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "harus 0x + 64 karakter hex");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  KMS_MASTER_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "harus 32 byte dalam base64 (AES-256)"),
  KMS_ISSUER_SIGNER_KEY: hex32,
  ISSUER_RELAYER_PRIVATE_KEY: hex32,
  SHARE_TOKEN_PEPPER: z.string().min(32),

  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().positive(),
  DIPLOMA_REGISTRY_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),

  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().default(3310),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  RATE_LIMIT_VERIFY_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/** Validasi env secara lazy agar `next build` tidak gagal tanpa secret. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Konfigurasi environment tidak valid:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
