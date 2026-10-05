import { handler, ok, parseBody } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { createCategory, listCategories } from "@/lib/services/categories";
import { createCategorySchema } from "@/lib/validators/category";

/** GET /api/categories — public. Powers the catalog filter and the landing showcase. */
export const GET = handler(async () => ok({ items: await listCategories() }), {
  name: "GET /api/categories",
});

/** POST /api/categories — staff. */
export const POST = handler(
  async (request) => {
    const { user } = await requireStaff();
    const input = await parseBody(createCategorySchema, request);
    const category = await createCategory(input, { id: user.id, role: user.role });

    return ok({ category }, undefined, 201);
  },
  { name: "POST /api/categories" },
);
