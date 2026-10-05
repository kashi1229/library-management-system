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
 * The form is mounted fresh — keyed by record id — each time the dialog opens,
 * so initial values come straight from props with no reset effect and no frame
 * showing the previous category's values.
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
  const isEdit = Boolean(category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
            {isEdit ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            A category groups related books in the catalog. Books must be reassigned before a category in
            use can be deleted.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <CategoryForm
            key={category?._id ?? "new"}
            category={category ?? null}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
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

  // `useWatch` is the memo-safe way to read fields for the live preview.
  const nameValue = useWatch({ control, name: "name" });
  const descriptionValue = useWatch({ control, name: "description" });
  const iconName = (useWatch({ control, name: "icon" }) ?? DEFAULT_CATEGORY_ICON) as CategoryIconName;
  const colorKey = (useWatch({ control, name: "color" }) ?? DEFAULT_CATEGORY_COLOR) as CategoryColor;

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
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={serverError} />

      {/* --------------------------- Live preview --------------------------- */}
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

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
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
  );
}