"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/common/form-alert";
import { CategoryIconTile } from "@/components/common/category-icon-tile";
import { IconPicker } from "@/components/features/categories/icon-picker";
import { ColorSwatchPicker } from "@/components/features/categories/color-swatch-picker";
import { ApiRequestError, categoriesApi, toErrorMessage } from "@/lib/api-client";
import {
  createCategorySchema,
  type CategoryIconName,
  type CreateCategoryInput,
  type CreateCategoryValues,
} from "@/lib/validators/category";
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON, type CategoryColor } from "@/lib/constants";
import type { CategorySummary } from "@/lib/api-client";

/**
 * Create / edit dialog (spec 07).
 *
 * Rendered only while open, and keyed by record id, so the form mounts fresh
 * every time: initial values come straight from props with no reset effect, and
 * `isDirty` reliably means "differs from what was loaded".
 */
export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  category?: CategorySummary | null;
  onSaved: (category: CategorySummary, mode: "created" | "updated") => void;
}) {
  if (!open) return null;

  return (
    <CategoryEditor
      key={category?._id ?? "new"}
      category={category ?? null}
      onDone={() => onOpenChange(false)}
      onSaved={onSaved}
    />
  );
}

/**
 * The dialog and its form, in one component.
 *
 * **Layout.** `DialogContent` has no height cap and is centred with
 * `translate-y-[-50%]`, so this dialog (title, live preview, two fields, a
 * 42-tile icon grid, six swatches) measured **1034px tall** and pushed its own
 * Save button off the bottom of every viewport under ~1040px — with nothing to
 * scroll and no way to reach it. It now caps at `100dvh - 2rem`, the middle
 * region is the only thing that scrolls, and the action row stays pinned. That
 * is the "sticky action footer for long forms" rule in `ui-context.md`.
 *
 * **Discard guard.** Escape, the close button, Cancel and a click outside all go
 * through `requestClose()`, which asks before dropping dirty input instead of
 * discarding the edits silently. The prompt is a pinned row under the header, not
 * a second modal, because nesting one inside a Radix dialog strands focus.
 */
function CategoryEditor({
  category,
  onDone,
  onSaved,
}: {
  category: CategorySummary | null;
  onDone: () => void;
  onSaved: (category: CategorySummary, mode: "created" | "updated") => void;
}) {
  const isEdit = Boolean(category);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const iconSearchId = React.useId();
  const swatchId = React.useId();

  // The schema uses `.default()` for icon/colour, so RHF is typed with the
  // *input* shape and the resolved *output* is what gets submitted.
  const form = useForm<CreateCategoryValues, unknown, CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      icon: (category?.icon ?? DEFAULT_CATEGORY_ICON) as CategoryIconName,
      color: (category?.color ?? DEFAULT_CATEGORY_COLOR) as CategoryColor,
    },
  });

  const { register, handleSubmit, setValue, control, formState } = form;
  const isDirty = formState.isDirty;

  // `useWatch` is the memo-safe way to read fields for the live preview.
  const nameValue = useWatch({ control, name: "name" });
  const descriptionValue = useWatch({ control, name: "description" });
  const iconName = (useWatch({ control, name: "icon" }) ?? DEFAULT_CATEGORY_ICON) as CategoryIconName;
  const colorKey = (useWatch({ control, name: "color" }) ?? DEFAULT_CATEGORY_COLOR) as CategoryColor;

  /** Any close path lands here, so dirty input is never dropped silently. */
  const requestClose = React.useCallback(() => {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onDone();
  }, [isDirty, onDone]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      const saved = category
        ? await categoriesApi.update(category._id, values)
        : await categoriesApi.create(values);

      toast.success(isEdit ? "Category updated" : "Category created", {
        description: isEdit
          ? `“${saved.name}” has been updated.`
          : `“${saved.name}” is ready to use.`,
      });
      onSaved(saved, isEdit ? "updated" : "created");
      onDone();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        // Server field errors land on the matching control.
        if (error.fields.name) form.setError("name", { type: "server", message: error.fields.name });
        if (error.fields.description) {
          form.setError("description", { type: "server", message: error.fields.description });
        }
        if (!error.fields.name && !error.fields.description) setServerError(error.message);
        return;
      }
      setServerError(toErrorMessage(error, "We could not save this category."));
    }
  });

  return (
    <Dialog open onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          requestClose();
        }}
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-6 pb-4 pr-14">
          <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
            {isEdit ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            A category groups related books in the catalog. Books must be reassigned before a category in
            use can be deleted.
          </DialogDescription>
        </DialogHeader>

        {/*
          The discard prompt is its own pinned row rather than a replacement for
          the action buttons. Swapping the footer out removed the form's only
          submit button, and a form with none falls into the implicit-submission
          path: a real click on "Keep editing" was submitting the form instead of
          dismissing the prompt. Keeping the submit button mounted removes that
          hazard and avoids the jump.
        */}
        {confirmDiscard ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-y border-border bg-warning-soft px-6 py-3">
            <p className="min-w-0 flex-1 text-small font-medium text-warning-ink">
              Discard the changes you made?
            </p>
            {/* `shrink-0` keeps the pair on one line; only the label wraps on a
                narrow dialog, so the two choices never split across rows. */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={onDone}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          {/* The only scrolling region. `overscroll-contain` stops a flick here from
              scrolling the page behind the modal. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-5">
            <FormAlert message={serverError} />

            {/* ------------------------- Live preview ------------------------- */}
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <CategoryIconTile icon={iconName} color={colorKey} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-small font-semibold text-foreground">
                  {nameValue?.trim() || "Category name"}
                </p>
                <p className="truncate text-caption text-muted-foreground">
                  {descriptionValue?.trim() || "A short description of this shelf."}
                </p>
              </div>
            </div>

            <Field label="Name" required error={formState.errors.name?.message}>
              <Input
                placeholder="Science Fiction"
                autoComplete="off"
                autoFocus
                {...register("name")}
                aria-invalid={formState.errors.name ? true : undefined}
              />
            </Field>

            <Field
              label="Description"
              helper="Optional. Shown on the category card and the landing page."
              error={formState.errors.description?.message}
            >
              <Textarea
                placeholder="Speculative fiction, dystopia and space opera."
                rows={3}
                {...register("description")}
                aria-invalid={formState.errors.description ? true : undefined}
              />
            </Field>

            <Field label="Icon" htmlFor={iconSearchId} helper={`Currently ${iconName}.`}>
              <IconPicker
                id={iconSearchId}
                value={iconName}
                onChange={(name) => setValue("icon", name, { shouldDirty: true })}
              />
            </Field>

            <Field
              label="Accent colour"
              htmlFor={`${swatchId}-${colorKey}`}
              helper="Used for the icon tile and generated book covers."
            >
              <ColorSwatchPicker
                id={swatchId}
                value={colorKey}
                onChange={(color) => setValue("color", color, { shouldDirty: true })}
              />
            </Field>
          </div>

{/* --------------------------- Action row --------------------------- */}
          <DialogFooter className="shrink-0 gap-3 border-t border-border bg-surface px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              className={isDirty ? "me-auto" : undefined}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || !isDirty || confirmDiscard}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create category"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}