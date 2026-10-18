import { handler, ok, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings, updateSettings } from "@/lib/services/settings";
import { updateSettingsSchema } from "@/lib/validators/settings";

/**
 * GET /api/settings — read full settings (admin only).
 */
export const GET = handler(
  async () => {
    await requireAdmin();
    const settings = await getSettings();
    return ok(settings);
  },
  { name: "GET /api/settings" },
);

/**
 * PATCH /api/settings — update library settings (admin only).
 *
 * `parseBody` like every other route: it validates and reports a malformed body as
 * 422 with per-field messages. This route used to call `request.json()` and
 * `schema.parse()` itself, which turns a missing or non-object body into a 500.
 */
export const PATCH = handler(
  async (request) => {
    const { actor } = await requireAdmin();
    const validated = await parseBody(updateSettingsSchema, request);
    const updated = await updateSettings(validated, actor);
    return ok(updated);
  },
  { name: "PATCH /api/settings" },
);