export const dynamic = "force-dynamic";

/** Health check untuk Docker HEALTHCHECK dan pengecekan setelah deploy (rollback otomatis). */
export function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
