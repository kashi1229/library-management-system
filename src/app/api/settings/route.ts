import { handler, ok } from "@/lib/api";
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
 */
export const PATCH = handler(
  async (request) => {
    const { actor } = await requireAdmin();
    const body = await request.json();
    const validated = updateSettingsSchema.parse(body);
    const updated = await updateSettings(validated, actor);
    return ok(updated);
  },
  { name: "PATCH /api/settings" },
);
