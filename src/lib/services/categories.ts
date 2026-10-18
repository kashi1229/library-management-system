import "server-only";
import { Types } from "mongoose";
import { AppError } from "@/lib/api";
import { Book, Category } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { slugify } from "@/lib/validators/category";
import type { CategoryIconName, CreateCategoryInput, UpdateCategoryInput } from "@/lib/validators/category";
import { CATEGORY_ICON_NAMES } from "@/lib/validators/category";
import type { Actor } from "@/types";
import type { CategoryDoc, CategorySummary } from "@/types";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  type CategoryColor,
} from "@/lib/constants";

/**
 * Category service — all business logic for F3.
 *
 * Deletion is blocked while any book still references the category, and the
 * error tells the user how many books need attention (business rule 11).
 * Every mutation is audited (invariant 11).
 */

export type CategoryWithCount = CategoryDoc & { bookCount: number };

/**
 * The client-facing shape: ids and dates already serialised to strings.
 *
 * **Declared in `types/index.ts`, once.** `code-standards.md` requires serialisation at the
 * boundary. Relying on `JSON.stringify` coercing an ObjectId to a string makes the wire format
 * agree with the declared type by accident, and leaves Server Components (Unit 08's book form)
 * unable to hand a category to a client component at all. One explicit serialiser, used by both
 * the route and the page, makes it correct by design.
 *
 * Re-exported rather than redeclared: it used to be declared here *and* in `api-client.ts`, and
 * the two copies drifted (only the client's narrowed `icon` to `CategoryIconName`). Anything
 * naming this from a Client Component would have had to import the `server-only` copy, so the
 * declaration moved to the client-safe `types/` module.
 */
export type { CategorySummary } from "@/types";

export function toCategorySummary(category: CategoryWithCount): CategorySummary {
  return {
    _id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    // Both are narrowed rather than cast. `icon` is validated against
    // `CATEGORY_ICON_NAMES` on write, but a document predating the whitelist (or
    // an edited one by hand) could hold a name that no longer resolves, and
    // passing it straight through would break the client's compile-time promise
    // that a stored icon always maps to a component.
    icon: isCategoryIconName(category.icon) ? category.icon : DEFAULT_CATEGORY_ICON,
    color: isCategoryColor(category.color) ? category.color : DEFAULT_CATEGORY_COLOR,
    bookCount: category.bookCount,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/** Narrow to one of the six `CATEGORY_COLORS` keys. */
function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === "string" && (CATEGORY_COLORS as readonly string[]).includes(value);
}

/** Narrow to one of the 42 whitelisted icon names. */
function isCategoryIconName(value: unknown): value is CategoryIconName {
  return typeof value === "string" && (CATEGORY_ICON_NAMES as readonly string[]).includes(value);
}

/**
 * Categories with a count of **active** books only.
 *
 * A single aggregation is used rather than N per-category counts, and archived
 * books are excluded so the public catalog filter never shows a category that
 * appears to have nothing in it.
 */
export async function listCategories(): Promise<CategoryWithCount[]> {
  const rows = await Category.aggregate<{ _id: Types.ObjectId; bookCount: number }>([
    {
      $lookup: {
        from: Book.collection.name,
        let: { categoryId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$category", "$$categoryId"] }, status: "active" } },
          { $count: "count" },
        ],
        as: "books",
      },
    },
    { $project: { bookCount: { $ifNull: [{ $first: "$books.count" }, 0] } } },
  ]);

  const counts = new Map(rows.map((row) => [row._id.toString(), row.bookCount]));

  const categories = await Category.find().sort({ name: 1 }).lean<CategoryDoc[]>();

  return categories.map((category) => ({
    ...category,
    bookCount: counts.get(category._id.toString()) ?? 0,
  }));
}

/**
 * Reject a duplicate name (case-insensitive) or slug before hitting the DB.
 */
async function assertUnique(name: string, slug: string, excludeId?: Types.ObjectId): Promise<void> {
  const clash = await Category.findOne({
    _id: excludeId ? { $ne: excludeId } : { $exists: true },
    $or: [{ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }, { slug }],
  }).lean<{ _id: Types.ObjectId }>();

  if (clash) {
    throw AppError.conflict("A category with that name already exists.", {
      name: "A category with that name already exists",
    });
  }
}

/**
 * A mutation response always carries `bookCount`.
 *
 * The grid writes the response straight into its cache, so omitting the count
 * would paint "undefined books" on the new card until the next revalidation.
 */
async function withBookCount(category: CategoryDoc): Promise<CategoryWithCount> {
  const bookCount = await Book.countDocuments({ category: category._id, status: "active" });
  return { ...category, bookCount };
}

/** Escape a user string before interpolating it into a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createCategory(
  input: CreateCategoryInput,
  actor: Actor,
): Promise<CategoryWithCount> {
  const slug = slugify(input.name);

  if (!slug) {
    throw AppError.validation("That name cannot be turned into a URL.", {
      name: "Use at least one letter or number",
    });
  }

  await assertUnique(input.name, slug);

  const category = await Category.create({
    name: input.name,
    slug,
    description: input.description ?? null,
    icon: input.icon,
    color: input.color,
  });

  await logAudit({
    actor,
    action: "category.create",
    entityType: "Category",
    entityId: category._id,
    summary: `Created category "${category.name}"`,
    meta: { slug, icon: category.icon, color: category.color },
  });

  return withBookCount(category.toObject() as CategoryDoc);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  actor: Actor,
): Promise<CategoryWithCount> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("Category not found.");

  const category = await Category.findById(id);
  if (!category) throw AppError.notFound("Category not found.");

  const before = {
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    color: category.color,
  };

  // Re-slug on rename so the public URL keeps matching the name (spec).
  if (input.name !== undefined && input.name !== category.name) {
    const slug = slugify(input.name);
    if (!slug) {
      throw AppError.validation("That name cannot be turned into a URL.", {
        name: "Use at least one letter or number",
      });
    }
    await assertUnique(input.name, slug, category._id);
    category.name = input.name;
    category.slug = slug;
  } else if (input.reslug) {
    const slug = slugify(category.name);
    if (slug && slug !== category.slug) {
      await assertUnique(category.name, slug, category._id);
      category.slug = slug;
    }
  }

  if (input.description !== undefined) category.description = input.description ?? null;
  if (input.icon !== undefined) category.icon = input.icon;
  if (input.color !== undefined) category.color = input.color;

  await category.save();

  await logAudit({
    actor,
    action: "category.update",
    entityType: "Category",
    entityId: category._id,
    summary: `Updated category "${category.name}"`,
    meta: {
      before,
      after: { name: category.name, slug: category.slug, icon: category.icon, color: category.color },
    },
  });

  return withBookCount(category.toObject() as CategoryDoc);
}

/**
 * Delete a category.
 *
 * Blocked while any book references it — including archived ones, because a
 * dangling reference would break the staff book table. The message names the
 * count so the user knows what to reassign first (F3).
 */
export async function deleteCategory(id: string, actor: Actor): Promise<{ id: string }> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("Category not found.");

  const category = await Category.findById(id).lean<CategoryDoc>();
  if (!category) throw AppError.notFound("Category not found.");

  const bookCount = await Book.countDocuments({ category: category._id });

  if (bookCount > 0) {
    throw AppError.rule(
      `“${category.name}” still has ${bookCount} ${bookCount === 1 ? "book" : "books"}. Reassign ${
        bookCount === 1 ? "it" : "them"
      } to another category, or archive ${bookCount === 1 ? "it" : "them"}, before deleting this category.`,
      { name: "This category is still in use" },
    );
  }

  await Category.deleteOne({ _id: category._id });

  await logAudit({
    actor,
    action: "category.delete",
    entityType: "Category",
    entityId: category._id,
    summary: `Deleted category "${category.name}"`,
    meta: { slug: category.slug },
  });

  return { id: category._id.toString() };
}
