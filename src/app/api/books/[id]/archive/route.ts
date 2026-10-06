import { handler, ok, parseBody, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { setArchived } from "@/lib/services/books";
import { archiveBookSchema, bookParamSchema } from "@/lib/validators/book";

/**
 * POST /api/books/:id/archive — staff.
 *
 * Body `{ archived: boolean }` toggles in both directions, so the client never
 * has to guess which verb to call. Archiving hides a book from the public
 * catalog; restoring brings it back without touching copy counts.
 */
export const POST = handler(
  async (request, { params }) => {
    const { user } = await requireStaff();
    const { id } = await parseParams(bookParamSchema, params);
    const { archived } = await parseBody(archiveBookSchema, request);

    const book = await setArchived(id, archived, { id: user.id, role: user.role });
    return ok({ book });
  },
  { name: "POST /api/books/:id/archive" },
);
