import { StatusBadge } from "@/components/common/status-badge";
import type { DashboardLowStockItem } from "@/types";
import { DashboardList } from "@/components/features/dashboard/dashboard-list";

/**
 * Books at or below one free copy.
 *
 * **The threshold is `<= 1`, not `== 0`** (`LOW_STOCK_THRESHOLD`, `services/dashboard.ts`). Zero
 * copies is *out* — a state the catalog already communicates everywhere else — and a librarian
 * cannot act on it by ordering in a hurry. One copy left is the number that reaches first, and
 * the one this list exists to catch.
 *
 * **Each row shows `n of m`, not just `n`.** "1" against a shelf of ten and "1" against a shelf
 * of one are very different problems, and only the pair tells them apart. This is the same "N of
 * M available" rule the staff books table uses (`ui-context.md` §Availability cell).
 */
export function LowStockList({ books }: { books: DashboardLowStockItem[] }) {
  return (
    <DashboardList
      title="Low stock"
      description="One copy left, or none on the shelf."
      items={books.length}
      emptyTitle="Every title has copies"
      emptyDescription="Nothing has dropped to one free copy or fewer."
    >
      {books.map((book) => (
        <div key={book.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-small text-foreground">{book.title}</p>
            <p className="mt-0.5 text-caption tabular-nums text-muted-foreground">
              {book.availableCopies} of {book.totalCopies} available
              {book.borrowCount > 0 ? <span> · borrowed {book.borrowCount}×</span> : null}
            </p>
          </div>
          {/* One copy is a warning; none is a fact the catalog badge already shouts. */}
          <StatusBadge
            status={book.availableCopies === 0 ? "unavailable" : "low"}
            label={book.availableCopies === 0 ? "Out" : "1 left"}
            className="shrink-0"
          />
        </div>
      ))}
    </DashboardList>
  );
}