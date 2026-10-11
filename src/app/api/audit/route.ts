import { handler, ok, parseQuery } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { listAudit } from "@/lib/services/audit";
import { listAuditQuerySchema } from "@/lib/validators/report";

/**
 * GET /api/audit — the audit trail. **Admin only.**
 *
 * **`requireAdmin()`, not `requireStaff()`.** The spec says *admin*, and the reason is the trail
 * itself: it records who reset a password, who waived a fine and who changed the policy, so a
 * librarian being able to read it means a librarian can see whether another librarian is under
 * investigation. The sidebar already hides the link from librarians (`navSections` splits the Admin
 * group by role); this is the guarantee behind the hiding.
 */
export const GET = handler(async (request) => {
  await requireAdmin();

  const query = parseQuery(listAuditQuerySchema, request);
  const audit = await listAudit(query);

  return ok(audit);
}, { name: "GET /api/audit" });