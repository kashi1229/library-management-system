import { createElement } from "react";
import { CATEGORY_COLOR_CLASS, DEFAULT_CATEGORY_COLOR, type CategoryColor } from "@/lib/constants";
import { getCategoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * The filled icon tile used for a category: an accent-coloured square with the
 * category glyph on it. Shared by the staff card and the dialog's live preview
 * so the two can never drift apart.
 *
 * The element is built with `createElement` rather than `<Icon />` because the
 * glyph is chosen by a whitelist lookup. `react-hooks/static-components` flags a
 * component resolved into a JSX tag during render, but the reference comes from
 * a frozen module-scope map, so its identity never changes and the subtree is
 * never remounted — the rule is a false positive for this pattern.
 *
 * The tile is decorative (`aria-hidden`): the category name is always rendered
 * as text beside it, so announcing the glyph too would just be noise.
 */
export function CategoryIconTile({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string | null | undefined;
  color: CategoryColor;
  /** `md` is the 44px card tile; `lg` the 48px dialog preview. */
  size?: "md" | "lg";
  className?: string;
}) {
  const swatch = CATEGORY_COLOR_CLASS[color] ?? CATEGORY_COLOR_CLASS[DEFAULT_CATEGORY_COLOR];

  return (
    <span
      aria-hidden="true"
      data-slot="category-icon-tile"
      className={cn(
        "grid shrink-0 place-items-center rounded-md",
        size === "lg" ? "size-12" : "size-11",
        swatch.bg,
        swatch.on,
        className,
      )}
    >
      {createElement(getCategoryIcon(icon), {
        className: size === "lg" ? "size-6" : "size-[22px]",
        strokeWidth: 1.75,
      })}
    </span>
  );
}