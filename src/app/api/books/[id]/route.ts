import { handler, ok, parseBody, parseParams } from "@/lib/api";
import { AppError } from "@/lib/api";
import { Types } from "mongoose";
import { getSession, requireStaff } from "@/lib/auth/session";
import { deleteBook, getCatalogBook, updateBook } from "@/lib/services/books";
import { bookParamSchema, updateBookSchema } from "@/lib/validators/book";

/**
 * GET /api/books/:id — public detail.
 *
 * Accepts a slug (what the catalog links to) or an ObjectId. Archived books are
 * hidden from the public: a member or anonymous caller asking for one gets the
 * same 404 as a book that does not exist, so the archive is not enumerable.
 * Staff still see archived books, because the staff table links here too.
 *
 * Returns the **catalog** shape — `effectiveAvailable`, `queueLength` and a
 * `userState` derived from the session — because that is what the book detail page
 * needs. The staff edit form reads through `getBook()` on the server instead, so it
 * keeps the raw copy counts.
 */
export const GET = handler(
  async (_request, { params }) => {
    const { id } = await parseParams(bookParamSchema, params);

    const session = await getSession();
    const isStaff = session !== null && (session.role === "librarian" || session.role === "admin");

    // `session.sub` is the user's id, and the service narrows it. A malformed id
    // cannot come from a signed token, but it is checked rather than asserted so a
    // bad token yields the neutral anonymous state instead of a 500.
    const userId =
      session && Types.ObjectId.isValid(session.sub) ? new Types.ObjectId(session.sub) : undefined;

    const book = await getCatalogBook(id, userId);

    if (book.status === "archived" && !isStaff) {
      throw AppError.notFound("That book could not be found.");
    }

    return ok({ book });
  },
  { name: "GET /api/books/:id" },
);

/** PATCH /api/books/:id — staff. Copy arithmetic and the audit diff live in the service. */
export const PATCH = handler(
  async (request, { params }) => {
    const { user } = await requireStaff();
    const { id } = await parseParams(bookParamSchema, params);
    const input = await parseBody(updateBookSchema, request);

    // `updateBook` needs an ObjectId; a slug here is a client mistake worth naming.
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw AppError.validation("Use the book id to update a book.", {
        id: "Update requires a book id, not a slug",
      });
    }

    const book = await updateBook(id, input, { id: user.id, role: user.role });
    return ok({ book });
  },
  { name: "PATCH /api/books/:id" },
);

/** DELETE /api/books/:id — staff. Refused once a book has been loaned. */
export const DELETE = handler(
  async (_request, { params }) => {
    const { user } = await requireStaff();
    const { id } = await parseParams(bookParamSchema, params);

    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw AppError.validation("Use the book id to delete a book.", {
        id: "Delete requires a book id, not a slug",
      });
    }

    const result = await deleteBook(id, { id: user.id, role: user.role });
    return ok(result);
  },
  { name: "DELETE /api/books/:id" },
);
