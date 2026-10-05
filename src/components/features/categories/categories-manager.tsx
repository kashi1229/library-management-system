"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Tags } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CategoryCard } from "@/components/features/categories/category-card";
import { CategoryDialog } from "@/components/features/categories/category-dialog";
import { categoriesApi, toErrorMessage, type CategorySummary } from "@/lib/api-client";

/** The API sorts by name; keep the optimistic insert in the same order. */
const byName = (a: CategorySummary, b: CategorySummary) => a.name.localeCompare(b.name);

/** SWR fetcher. The key argument is unused because the endpoint takes no query. */
const fetcher = (_key: string) => categoriesApi.list();

/**
 * Staff category management.
 *
 * SWR owns the cache; mutations are applied optimistically so the grid responds
 * instantly, and rolled back if the request fails. `mutate` revalidates
 * afterwards so the grid always converges on the server's ordering and counts.
 */
export function CategoriesManager() {
  const { data, error, isLoading, mutate } = useSWR<CategorySummary[]>("/api/categories", fetcher, {
    revalidateOnFocus: false,
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategorySummary | null>(null);
  const [deleting, setDeleting] = React.useState<CategorySummary | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const categories = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (category: CategorySummary) => {
    setEditing(category);
    setDialogOpen(true);
  };

  /**
   * Insert or replace a category without waiting for the round trip.
   *
   * The API echoes `bookCount` on create and update, so the optimistic card
   * already shows the right number — `revalidate` then confirms it.
   */
  const handleSaved = React.useCallback(
    (category: CategorySummary, mode: "created" | "updated") => {
      void mutate(
        (current) => {
          if (!current) return current;
          if (mode === "created") return [...current, category].sort(byName);
          return current.map((item) => (item._id === category._id ? { ...item, ...category } : item));
        },
        { revalidate: true },
      );
    },
    [mutate],
  );

  const confirmDelete = async () => {
    if (!deleting) return;

    // Captured before the optimistic write so a failure restores the exact list.
    const previous = categories;
    setDeletePending(true);
    void mutate(
      (current) => current?.filter((item) => item._id !== deleting._id) ?? current,
      { revalidate: false },
    );

    try {
      await categoriesApi.remove(deleting._id);
      toast.success("Category deleted", { description: `“${deleting.name}” has been removed.` });
      setDeleting(null);
      // Revalidate in place; re-seeding `previous` would flash the row back.
      void mutate();
    } catch (error) {
      void mutate(previous, { revalidate: true });
      toast.error("Could not delete this category", {
        description: toErrorMessage(error, "Please try again."),
      });
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="container-page space-y-8">
      <PageHeader
        title="Categories"
        description="Shelves that group related books in the catalog and on the landing page."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New category
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={Tags}
          title="Could not load categories"
          description="Something went wrong reaching the server. Check your connection and try again."
          action={
            <Button onClick={() => void mutate()}>
              Try again
            </Button>
          }
        />
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Tags}
            title="No categories yet — create the first shelf"
            description="Categories group related books so members can browse the catalog by subject."
            action={
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                New category
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <CategoryCard
              key={category._id}
              category={category}
              index={index}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete “${deleting?.name ?? ""}”?`}
        consequence={
          deleting && deleting.bookCount > 0
            ? `This shelf holds ${deleting.bookCount} ${
                deleting.bookCount === 1 ? "book" : "books"
              }. Reassign or archive ${
                deleting.bookCount === 1 ? "it" : "them"
              } first — the library will not delete a category that is still in use.`
            : "This cannot be undone. The library will still refuse if any book — an archived one included — still points at this shelf."
        }
        confirmLabel="Delete category"
        onConfirm={confirmDelete}
      />

      {/* Progress is announced politely while the delete request is in flight. */}
      <span aria-live="polite" className="sr-only">
        {deletePending ? "Deleting category…" : ""}
      </span>
    </div>
  );
}
