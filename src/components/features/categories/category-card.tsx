"use client";

import { motion } from "motion/react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { CategoryIconTile } from "@/components/common/category-icon-tile";
import type { CategorySummary } from "@/lib/api-client";

/**
 * One category card (spec 07).
 *
 * Layout is deliberately **vertical**: the accent tile and the row menu share a
 * top line, so the name and description get the card's full width. A side-by-side
 * tile left only ~95px for the heading inside a four-column grid, which truncated
 * almost every name to "Art…".
 *
 * The tile is filled with the category accent, so its glyph uses the
 * theme-independent ink for that accent (`CATEGORY_COLOR_CLASS[color].on`) —
 * `primary-foreground` would drop to ~1.4:1 on forest in dark mode. The whole
 * card lifts on hover, and the actions live in a `MoreHorizontal` menu so the
 * grid stays calm.
 */
export function CategoryCard({
  category,
  onEdit,
  onDelete,
  index = 0,
}: {
  category: CategorySummary;
  onEdit: (category: CategorySummary) => void;
  onDelete: (category: CategorySummary) => void;
  /** Position in the grid, used for the staggered entrance. */
  index?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const description = category.description?.trim() || "No description yet.";

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { duration: 0.25, delay: Math.min(index, 11) * 0.04, ease: [0.22, 1, 0.36, 1] }
      }
      whileHover={reduced ? undefined : { y: -2 }}
      className="h-full"
    >
      <Card className="group h-full transition-shadow duration-200 hover:shadow-lift">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <CategoryIconTile icon={category.icon} color={category.color} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${category.name}`}
                  className="-mt-1 -mr-1 text-muted-foreground"
                >
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(category)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete(category)}
                  className="text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Full card width from here down. */}
          <div className="min-w-0">
            <h3
              className="text-balance font-display text-h3 leading-tight font-semibold tracking-[-0.02em] text-foreground"
              title={category.name}
            >
              {category.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-small leading-relaxed text-muted-foreground" title={description}>
              {description}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
            <Badge variant="secondary">
              {category.bookCount} {category.bookCount === 1 ? "book" : "books"}
            </Badge>
            <code className="truncate font-mono text-code text-muted-foreground" title={`/${category.slug}`}>
              /{category.slug}
            </code>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}