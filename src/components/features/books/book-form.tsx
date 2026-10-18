"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/common/form-alert";
import { BookCover } from "@/components/common/book-cover";
import { ImageUploader } from "@/components/common/image-uploader";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { formatDate } from "@/lib/utils";
import {
  BookBasicSection,
  BookInventorySection,
  BookPublicationSection,
} from "@/components/features/books/book-form-sections";
import { ApiRequestError, booksApi, toErrorMessage } from "@/lib/api-client";
import { createBookSchema, type CreateBookInput, type CreateBookValues } from "@/lib/validators/book";
import { DEFAULT_CATEGORY_COLOR, type CategoryColor } from "@/lib/constants";
import type { BookCategory, BookDetail } from "@/lib/api-client";
import type { CloudinaryImage } from "@/types";

/**
 * Create / edit form for a book (spec 08).
 *
 * One component serves both pages. `book` is present when editing and absent when
 * creating, and it is `null`-able rather than an empty object so `availableCopies`
 * (which is system-managed) can never be seeded from a default.
 *
 * **Layout.** Two columns from `lg`: the cover uploader and a live `BookCover`
 * preview on the left, the three field groups on the right. A **sticky footer**
 * carries Cancel and Save, because the form is long enough on a laptop that the
 * save button would otherwise scroll out of reach — the same trap the Unit 07
 * dialog hit, and the rule `ui-context.md` states for long forms.
 *
 * **Discard guard.** `useUnsavedChangesGuard` intercepts in-app link clicks and
 * the browser's own unload prompt, so navigating away from a dirty form asks
 * first. Every explicit Cancel route asks too.
 */
export function BookForm({
  book,
  categories,
}: {
  /** The book being edited. `null` creates a new one. */
  book: BookDetail | null;
  /** Every category, for the picker. Empty means staff must create one first. */
  categories: BookCategory[];
}) {
  const router = useRouter();
  const isEdit = book !== null;
  const onLoan = book ? book.onLoan : 0;

  const [serverError, setServerError] = React.useState<string | null>(null);

  /**
   * RHF is typed with the schema's **input** shape (`CreateBookValues`, all
   * optional fields as strings) because that is what the form actually holds, and
   * the schema's **output** (`CreateBookInput`) is what gets submitted. The two
   * differ: `isbn: ""` becomes `undefined`, `"2024"` becomes `2024`. Same pattern
   * the Unit 07 dialog uses, for the same reason.
   */
  const form = useForm<CreateBookValues, unknown, CreateBookInput>({
    resolver: zodResolver(createBookSchema),
    mode: "onBlur",
    defaultValues: {
      title: book?.title ?? "",
      authors: book?.authors ?? [],
      isbn: book?.isbn ?? "",
      publisher: book?.publisher ?? "",
      edition: book?.edition ?? "",
      publishedYear: book?.publishedYear != null ? String(book.publishedYear) : "",
      // "English", not "": the select is optional to *change*, but the schema
      // requires a non-empty language, so seeding the field with an empty string
      // made a brand-new book impossible to submit without touching a control the
      // user had no reason to touch. An existing book keeps its stored value.
      language: book?.language ?? "English",
      category: book?.category._id ?? "",
      tags: book?.tags ?? [],
      description: book?.description ?? "",
      pageCount: book?.pageCount != null ? String(book.pageCount) : "",
      shelfLocation: book?.shelfLocation ?? "",
      totalCopies: book?.totalCopies ?? 1,
      cover: book?.cover ?? null,
    },
  });

  const { setValue, control, formState } = form;
  const disabled = formState.isSubmitting;

  // Live preview values. `useWatch` is the memo-safe way to read form state
  // during render without subscribing the whole form to every keystroke.
  const cover = useWatch({ control, name: "cover" }) as CloudinaryImage | null | undefined;
  const titleValue = useWatch({ control, name: "title" }) as string | undefined;
  const authorsValue = useWatch({ control, name: "authors" }) as string[] | undefined;

  // The preview follows the form until the user uploads, then the upload wins.
  // Once a cover is present the generated one is not shown at all, because a
  // staff member should not have to guess which image will be saved.
  const previewColor = pickPreviewColor(categories, book);
  const showGenerated = !cover;

  const backHref = "/staff/books";

  /**
   * The destination the guard caught us heading for, or `null` when no prompt is
   * showing. One piece of state covers both cases: an explicit Cancel sets it to
   * the table, an intercepted link sets it to wherever the user was going, and the
   * prompt opens whenever it is non-null.
   *
   * This was a genuine bug: `blockedHref` was recorded but never used to *open*
   * anything, so clicking a link on a dirty form silently swallowed the click. The
   * form looked frozen and nothing explained why.
   */
  const [blockedHref, setBlockedHref] = React.useState<string | null>(null);

  // Set synchronously immediately before a navigation this form itself initiates,
  // so the guard does not intercept its own post-save redirect.
  const { allowNavigation } = useUnsavedChangesGuard({
    dirty: formState.isDirty,
    onBlocked: setBlockedHref,
  });

  /** One place for every "you are about to lose edits" decision. */
  const requestLeave = React.useCallback(() => {
    if (formState.isDirty) {
      setBlockedHref(backHref);
      return;
    }
    router.push(backHref);
  }, [backHref, formState.isDirty, router]);

  /** Confirmed: go to `href`, but never to a foreign origin. */
  const goTo = React.useCallback(
    (href: string) => {
      const target = new URL(href, window.location.origin);
      // The guard only ever blocks same-origin routes, so this re-check is
      // belt-and-braces against a crafted href reaching `router.push`.
      if (target.origin !== window.location.origin) return;
      router.push(`${target.pathname}${target.search}${target.hash}`);
    },
    [router],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      const saved = isEdit
        ? await booksApi.update(book._id, values)
        : await booksApi.create(values);

      toast.success(isEdit ? "Book updated" : "Book added to the catalog", {
        description: isEdit
          ? `Changes to “${saved.title}” are saved.`
          : `“${saved.title}” is now in the catalog with ${saved.availableCopies} of ${saved.totalCopies} copies available.`,
      });

      // Order matters. `allowNavigation` runs *synchronously* before the push,
      // because `form.reset` only clears `isDirty` on the next commit — and Next's
      // router fires `navigate` during the push, while our listener is still
      // installed and still sees `dirty === true`. Without this the form's own
      // successful redirect is blocked by its own guard and the save looks like it
      // did nothing.
      allowNavigation();
      form.reset(serializeFor(saved));
      router.push(backHref);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        // Server field errors land on the matching control, so a duplicate ISBN
        // or a copy-count rule reads as an inline error rather than a banner.
        for (const [name, message] of Object.entries(error.fields)) {
          form.setError(name as FieldPath<CreateBookValues>, { type: "server", message });
        }
        if (!Object.keys(error.fields).length) setServerError(error.message);
        return;
      }
      setServerError(
        toErrorMessage(error, isEdit ? "We could not save this book." : "We could not add this book."),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="container-page space-y-6 pb-32">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={requestLeave}
            className="-ms-3 text-muted-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to books
          </Button>
          <h1 className="mt-1 text-h2 font-display font-semibold tracking-[-0.02em] text-foreground">
            {isEdit ? "Edit book" : "Add a book"}
          </h1>
          <p className="mt-1 text-body text-muted-foreground">
            {isEdit
              ? `Added ${formatDate(book.createdAt)}. Every change is recorded in the audit log.`
              : "Everything except the cover and ISBN is searchable in the catalog."}
          </p>
        </div>
      </div>

      <FormAlert message={serverError} />

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------ Cover ------------------------------ */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-h4">Cover</CardTitle>
              <CardDescription>
                Portrait artwork works best. Without one we generate a typographic cover.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploader
                folder="covers"
                aspect="cover"
                value={cover ?? null}
                onChange={(next) => setValue("cover", next, { shouldDirty: true })}
                disabled={disabled}
                hint="2:3 ratio"
              />
            </CardContent>
          </Card>

          {/* Live preview: exactly what a member sees in the catalog. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-h4">Catalog preview</CardTitle>
              <CardDescription>How this book will appear to readers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <BookCover
                  publicId={showGenerated ? null : cover?.publicId}
                  url={showGenerated ? null : cover?.url}
                  title={titleValue?.trim() || "Untitled book"}
                  author={authorsValue?.[0] ?? null}
                  categoryColor={previewColor}
                  width={240}
                  sizes="120px"
                  className="w-[5.5rem] shrink-0 sm:w-28"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-3 text-small font-medium text-foreground">
                    {titleValue?.trim() || "Untitled book"}
                  </p>
                  <p className="line-clamp-2 text-caption text-muted-foreground">
                    {(authorsValue ?? []).join(", ") || "No author yet"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------ Fields ----------------------------- */}
        <div className="space-y-6">
          <FormCard
            title="Basic info"
            description="What the book is, and where it sits in the catalog."
          >
            <BookBasicSection form={form} disabled={disabled} categories={categories} />
          </FormCard>

          <FormCard
            title="Publication"
            description="Edition details. ISBN and tags are searchable."
          >
            <BookPublicationSection form={form} disabled={disabled} />
          </FormCard>

          <FormCard
            title="Inventory"
            description="How many copies the library owns, and where they are kept."
          >
            <BookInventorySection form={form} disabled={disabled} onLoan={onLoan} />
          </FormCard>
        </div>
      </div>

      {/* --------------------------- Sticky footer --------------------------- */}
      {/*
        Pinned to the bottom of the viewport. The form is roughly 1400px tall on a
        desktop, so without this the only way to save is to scroll to the very end
        and hunt for the button. `pb-32` on the form reserves the matching space so
        the last field is never hidden underneath it.
      */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="container-page flex items-center gap-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p aria-live="polite" className="me-auto min-w-0 text-small text-muted-foreground">
            {formState.isDirty ? "You have unsaved changes." : isEdit ? "No changes yet." : ""}
          </p>
          <Button type="button" variant="outline" onClick={requestLeave} disabled={disabled}>
            Cancel
          </Button>
          <Button type="submit" disabled={disabled || categories.length === 0}>
            {disabled ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden="true" />
                {isEdit ? "Save changes" : "Add book"}
              </>
            )}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={blockedHref !== null}
        onOpenChange={(open) => {
          // Closing (Escape, Cancel, outside click) means "keep editing", so the
          // caught destination is released and the form stays put.
          if (!open) setBlockedHref(null);
        }}
        title="Leave without saving?"
        consequence="Your changes to this book have not been saved, and leaving the page will discard them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          // `allowNavigation` before `reset`, for the same reason as after a
          // save: the listener is still installed at this instant and would
          // otherwise cancel the navigation the user just confirmed.
          const destination = blockedHref;
          allowNavigation();
          form.reset();
          setBlockedHref(null);
          if (destination === backHref) router.push(backHref);
          else if (destination) goTo(destination);
        }}
      />
    </form>
  );
}

/** One titled group, so the three sections share one anatomy. */
function FormCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-h4">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

/** Resolve the accent for the generated cover preview. */
function pickPreviewColor(
  categories: BookCategory[],
  book: BookDetail | null,
): CategoryColor {
  if (book) return book.category.color;
  return DEFAULT_CATEGORY_COLOR;
}

/** Rebuild the form's input values from a freshly saved book. */
function serializeFor(saved: BookDetail): CreateBookValues {
  return {
    title: saved.title,
    authors: saved.authors,
    isbn: saved.isbn ?? "",
    publisher: saved.publisher ?? "",
    edition: saved.edition ?? "",
    publishedYear: saved.publishedYear != null ? String(saved.publishedYear) : "",
    language: saved.language,
    category: saved.category._id,
    tags: saved.tags,
    description: saved.description ?? "",
    pageCount: saved.pageCount != null ? String(saved.pageCount) : "",
    shelfLocation: saved.shelfLocation ?? "",
    totalCopies: saved.totalCopies,
    cover: saved.cover ?? null,
  };
}

