import { Types } from "mongoose";
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

    // The session user id goes to `listBooks` so each card can carry its own `wishlisted`
    // flag — one query for the whole page, not one per card. It comes from the **cookie
    // only** (invariant 3), never from a query parameter, so nobody can ask which books a
    // given member has saved.
    const userId = session ? new Types.ObjectId(session.sub) : undefined;

    const { items, meta } = await listBooks({ ...query, status }, userId);

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
