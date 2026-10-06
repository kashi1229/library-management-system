import { handler, ok, parseParams, AppError } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { listRelatedBooks } from "@/lib/services/books";
import { bookParamSchema } from "@/lib/validators/book";

/**
 * GET /api/books/:id/related — public.
 *
 * Same category, excluding the book itself, most-borrowed first (F5). The category
 * is echoed back so the client can label the section without a second request.
 *
 * An archived book 404s here for non-staff, matching `GET /api/books/:id`: a book
 * that cannot be read must not be able to advertise its neighbours either.
 */
export const GET = handler(
  async (_request, { params }) => {
    const { id } = await parseParams(bookParamSchema, params);

    const session = await getSession();
    const isStaff = session !== null && (session.role === "librarian" || session.role === "admin");

    try {
      const items = await listRelatedBooks(id, 6);
      return ok({ items });
    } catch (error) {
      // Re-thrown as a plain 404 for non-staff so the archive is not discoverable
      // through this route. Staff keep the real reason.
      if (!isStaff && error instanceof AppError && error.code === "NOT_FOUND") {
        throw AppError.notFound("That book could not be found.");
      }
      throw error;
    }
  },
  { name: "GET /api/books/:id/related" },
);