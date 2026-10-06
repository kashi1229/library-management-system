import { handler, ok, parseBody } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { bulkArchive } from "@/lib/services/books";
import { bulkArchiveSchema } from "@/lib/validators/book";

/**
 * POST /api/books/bulk-archive — staff.
 *
 * Declared as its own segment rather than folded into `POST /api/books`, because
 * `create` and `bulk-archive` are different verbs on the same collection and a
 * body switch inside one handler is exactly the kind of ambiguity that turns
 * into a wrong write later.
 *
 * Idempotent: books that are already archived are reported as `skipped` rather
 * than failing the batch, so re-running a selection is safe.
 */
export const POST = handler(
  async (request) => {
    const { user } = await requireStaff();
    const { ids } = await parseBody(bulkArchiveSchema, request);

    const result = await bulkArchive(ids, { id: user.id, role: user.role });
    return ok(result);
  },
  { name: "POST /api/books/bulk-archive" },
);
