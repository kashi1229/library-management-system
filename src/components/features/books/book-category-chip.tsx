"use client";

import { CategoryIconTile } from "@/components/common/category-icon-tile";
import type { BookCategory } from "@/lib/api-client";

/**
 * Category name on the category's own accent tile, so the table reads as one
 * system with the catalog cards rather than as a list of unrelated chips.
 *
 * The tile resolves its icon from the frozen whitelist in `lib/icons.ts`, so a
 * stored name can neither fail to resolve nor change identity between renders.
 */
export function BookCategoryChip({ category }: { category: BookCategory }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      <CategoryIconTile
        icon={category.icon}
        color={category.color}
        className="size-6 shrink-0 rounded-[4px] [&_svg]:size-3.5"
      />
      <span className="truncate text-caption text-muted-foreground">{category.name}</span>
    </span>
  );
}