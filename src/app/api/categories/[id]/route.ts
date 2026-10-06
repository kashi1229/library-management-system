import { handler, ok, parseBody, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { deleteCategory, toCategorySummary, updateCategory } from "@/lib/services/categories";
import { categoryIdSchema, updateCategorySchema } from "@/lib/validators/category";

/** PATCH /api/categories/:id — staff. Re-slugs automatically on rename. */
export const PATCH = handler(
  async (request, { params }) => {
    const { user } = await requireStaff();
    const { id } = await parseParams(categoryIdSchema, params);
    const input = await parseBody(updateCategorySchema, request);

    const category = await updateCategory(id, input, { id: user.id, role: user.role });
    return ok({ category: toCategorySummary(category) });
  },
  { name: "PATCH /api/categories/:id" },
);

/** DELETE /api/categories/:id — staff. Blocked while any book still references it. */
export const DELETE = handler(
  async (request, { params }) => {
    const { user } = await requireStaff();
    const { id } = await parseParams(categoryIdSchema, params);

    const result = await deleteCategory(id, { id: user.id, role: user.role });
    return ok(result);
  },
  { name: "DELETE /api/categories/:id" },
);
