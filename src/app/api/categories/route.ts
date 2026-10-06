import { handler, ok, parseBody } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import {
  createCategory,
  listCategories,
  toCategorySummary,
} from "@/lib/services/categories";
import { createCategorySchema } from "@/lib/validators/category";

/**
 * GET /api/categories - public. Powers the catalog filter and the landing showcase.
 *
 * Serialised through `toCategorySummary` so the wire format matches the declared
 * `CategorySummary` type exactly, rather than depending on `JSON.stringify` to
 * coerce ObjectIds for us.
 */
export const GET = handler(async () => ok({ items: (await listCategories()).map(toCategorySummary) }), {
  name: "GET /api/categories",
});

/** POST /api/categories - staff. */
export const POST = handler(
  async (request) => {
    const { user } = await requireStaff();
    const input = await parseBody(createCategorySchema, request);
    const category = await createCategory(input, { id: user.id, role: user.role });

    return ok({ category: toCategorySummary(category) }, undefined, 201);
  },
  { name: "POST /api/categories" },
);