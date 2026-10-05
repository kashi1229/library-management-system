import { z } from "zod";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_ICON, DEFAULT_CATEGORY_COLOR } from "@/lib/constants";

/**
 * Category schemas.
 *
 * `icon` is validated against the **curated whitelist in `lib/icons.ts`**, not a
 * free string, so a stored icon name always resolves to a real component. A
 * dynamic `import()` keyed on user input would also be a bundle-injection risk,
 * which the whitelist rules out by construction.
 */

export const CATEGORY_ICON_NAMES = [
  "BookOpen",
  "Landmark",
  "Globe",
  "FlaskConical",
  "Atom",
  "Cpu",
  "Briefcase",
  "Scale",
  "Music",
  "Palette",
  "PenLine",
  "Feather",
  "Leaf",
  "Users",
  "Library",
  "Tags",
  "BarChart3",
  "Heart",
  "Clock",
  "Star",
  "ShieldCheck",
  "ScrollText",
  "Compass",
  "Lightbulb",
  "Languages",
  "Music4",
  "Drama",
  "Camera",
  "Ruler",
  "Calculator",
  "Microscope",
  "Telescope",
  "Wrench",
  "Shirt",
  "Utensils",
  "Dumbbell",
  "GraduationCap",
  "Building2",
  "Plane",
  "Anchor",
  "Mountain",
  "Trees",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

/**
 * The raw field schemas, deliberately **without** `.default()`.
 *
 * Both the create and the update schema are composed from these. Defaults are
 * applied per-schema instead, because Zod 4's `.partial()` keeps an inner
 * `.default()`: `createCategorySchema.partial()` would silently re-apply
 * `icon: "BookOpen"` and `color: "forest"` to every PATCH and wipe the stored
 * values whenever a category was renamed.
 */
const nameField = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(40, "Name must be 40 characters or fewer");

/** An empty textarea submits `""`; normalise it to "absent" so it stores as null. */
const descriptionField = z
  .string()
  .trim()
  .max(200, "Description must be 200 characters or fewer")
  .optional()
  .transform((value) => (value ? value : undefined));

const iconField = z.enum(CATEGORY_ICON_NAMES, { error: "Choose an icon from the list" });

const colorField = z.enum(CATEGORY_COLORS, {
  error: `Colour must be one of: ${CATEGORY_COLORS.join(", ")}`,
});

export const createCategorySchema = z.object({
  name: nameField,
  description: descriptionField,
  icon: iconField.default(DEFAULT_CATEGORY_ICON),
  color: colorField.default(DEFAULT_CATEGORY_COLOR),
});

export const updateCategorySchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField,
    icon: iconField.optional(),
    color: colorField.optional(),
    /** Force a re-slug even when the name is unchanged. */
    reslug: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Send at least one field to update.",
  });

/** Shared input/output types. `icon`/`color` use `.default()`, so I and O differ. */
export type CreateCategoryValues = z.input<typeof createCategorySchema>;
export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;

/** `/api/categories/:id` */
export const categoryIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid category id"),
});

/** `slugify` helper shared by the service and the seed script. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    // Strip combining diacritics left behind by NFKD.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}