import { handler, ok } from "@/lib/api";
import { isConnected } from "@/lib/db";

/**
 * Liveness probe. Connects to MongoDB (via the `handler` wrapper) and reports
 * both the app and the database state. Public: never leaks credentials, only a
 * coarse status string.
 */
export const GET = handler(async () => ok({ status: "ok" as const, db: isConnected() ? ("connected" as const) : ("disconnected" as const) }), {
  name: "GET /api/health",
});
