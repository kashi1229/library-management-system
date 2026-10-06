import { handler, ok, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { createLibrarian, listTeam } from "@/lib/services/team";
import { createLibrarianSchema } from "@/lib/validators/members";

/**
 * GET /api/team — **admin only**.
 *
 * `requireAdmin()` runs before anything else, so a librarian's request is refused
 * without touching the database. The page guards too (`/staff/team` redirects), but
 * that is presentation; this is the enforcement.
 */
export const GET = handler(async () => {
  await requireAdmin();
  return ok({ items: await listTeam() });
}, { name: "GET /api/team" });

/**
 * POST /api/team — admin only. Create a librarian.
 *
 * A duplicate email comes back as a 409 naming the `email` field, so the form can put
 * the message beside the input rather than in a banner at the top of a dialog.
 */
export const POST = handler(async (request) => {
  const { user } = await requireAdmin();
  const input = await parseBody(createLibrarianSchema, request);

  const member = await createLibrarian(input, { id: user.id, role: user.role });
  return ok({ member }, undefined, 201);
}, { name: "POST /api/team" });