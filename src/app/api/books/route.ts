import { handler, ok, parseBody, parseQuery } from "@/lib/api";
import { getSession, requireStaff } from "@/lib/auth/session";
import { createBook, listBooks } from "@/lib/services/books";
import { createBookSchema, listBooksQuerySchema } from "@/lib/validators/book";

/**
 * GET /api/books — public read, filtered by role.
 *
 * Anonymous and member callers get **active books only**, which is what the
 * public catalog needs (Unit 09). A signed-in librarian or admin may pass
 * `status=archived` / `all` for the staff table.
 *
 * The role is re-read from the database rather than trusted from the token, and
 * the downgrade is enforced here instead of in the service, so the rule holds for
 * every caller regardless of which route reaches `listBooks`.
 */
export const GET = handler(
  async (request) => {
    const query = parseQuery(listBooksQuerySchema, request);
    const session = await getSession();
    const isStaff = session !== null && (session.role === "librarian" || session.role === "admin");

    const status = isStaff ? query.status : "active";
    const { items, meta } = await listBooks({ ...query, status });

    return ok({ items }, meta);
  },
  { name: "GET /api/books" },
);

/** POST /api/books — staff. `availableCopies` is set by the service, not the client. */
export const POST = handler(
  async (request) => {
    const { user } = await requireStaff();
    const input = await parseBody(createBookSchema, request);
    const book = await createBook(input, { id: user.id, role: user.role });
    return ok({ book }, undefined, 201);
  },
  { name: "POST /api/books" },
);
