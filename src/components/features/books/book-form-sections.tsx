"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IsbnField } from "@/components/features/books/isbn-field";
import { AuthorsInput } from "@/components/features/books/authors-input";
import { TagInput } from "@/components/features/books/tag-input";
import { CopiesBar } from "@/components/features/books/copies-bar";
import { LANGUAGES } from "@/lib/constants";
import type { BookCategory } from "@/lib/api-client";
import type { CreateBookInput, CreateBookValues } from "@/lib/validators/book";

/**
 * The three grouped sections of the book form (spec 08): Basic Info,
 * Publication and Inventory.
 *
 * They are presentational on purpose. Every control is wired through
 * `register`/`setValue` by the parent `BookForm`, so the form owns submission and
 * these components own layout and labelling only. Splitting them out keeps each
 * file well under the 200-line ceiling in `code-standards.md` without inventing an
 * abstraction the app does not need elsewhere.
 *
 * **The Inventory section is the important one.** `availableCopies` is
 * system-managed, so staff edit `totalCopies` and the derived availability is
 * shown as live feedback *before* saving. When the book already has copies out,
 * the section states the floor and the input's `min` is that number, so the
 * browser rejects an impossible total before the request is ever sent (the
 * service re-checks it regardless — invariant 4).
 */

/** The sentinel for "the book is written in a language not on the list". */
export const OTHER_LANGUAGE = "__other__";

/**
 * The form handle the sections read.
 *
 * Typed with RHF's three generics exactly as `BookForm` declares it — the input
 * shape, `unknown` for the resolver context, and the schema's output shape. A
 * two-generic `UseFormReturn<CreateBookValues>` defaults its third parameter to
 * the first, so passing one of those here is a genuine type error rather than a
 * cosmetic mismatch, and it keeps the sections from accidentally submitting the
 * untransformed values.
 */
type SectionProps = {
  form: UseFormReturn<CreateBookValues, unknown, CreateBookInput>;
  disabled: boolean;
};

/* -------------------------------------------------------------------------- */
/* Basic info                                                                  */
/* -------------------------------------------------------------------------- */

export function BookBasicSection({ form, disabled, categories }: SectionProps & { categories: BookCategory[] }) {
  const { register, setValue, control, formState } = form;

  return (
    <div className="space-y-5">
      <Field
        label="Title"
        required
        error={formState.errors.title?.message}
        helper="Shown on the cover, the catalog card and search results."
      >
        <Input
          placeholder="The Left Hand of Darkness"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={formState.errors.title ? true : undefined}
          {...register("title")}
        />
      </Field>

      <Field
        label="Authors"
        required
        htmlFor="book-authors"
        error={formState.errors.authors?.message}
        helper="Press Enter or comma after each name. Order is preserved."
      >
        <AuthorsInput
          id="book-authors"
          value={useWatch({ control, name: "authors" }) ?? []}
          onChange={(next) => setValue("authors", next, { shouldDirty: true, shouldValidate: true })}
          disabled={disabled}
          invalid={Boolean(formState.errors.authors)}
        />
      </Field>

      <Field
        label="Category"
        required
        error={formState.errors.category?.message}
        helper="Every book belongs to exactly one shelf."
      >
        <Select
          value={(useWatch({ control, name: "category" }) as string) || undefined}
          onValueChange={(value) => setValue("category", value, { shouldDirty: true, shouldValidate: true })}
          disabled={disabled}
        >
          <SelectTrigger className="w-full" aria-label="Category">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.length === 0 ? (
              <SelectItem value="none" disabled>
                No categories yet
              </SelectItem>
            ) : (
              categories.map((category) => (
                <SelectItem key={category._id} value={category._id}>
                  {category.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Description"
        error={formState.errors.description?.message}
        helper={`Shown on the book detail page. ${useWatch({ control, name: "description" })?.length ?? 0} of 2000 characters.`}
      >
        <Textarea
          rows={5}
          placeholder="A lone envoy is sent to the frozen world of Gethen to invite its nations to join the galactic coalition."
          disabled={disabled}
          aria-invalid={formState.errors.description ? true : undefined}
          {...register("description")}
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Publication                                                                 */
/* -------------------------------------------------------------------------- */

export function BookPublicationSection({ form, disabled }: SectionProps) {
  const { register, setValue, control, formState } = form;

  // Read as `""` rather than defaulting to English: the select already shows
  // English when this is blank, and defaulting here would make the free-text
  // "Other" branch write "English" into a book the user is renaming.
  const language = (useWatch({ control, name: "language" }) as string) ?? "";

  // A stored language may not be in the list (a book catalogued before the list
  // existed, or a free-text one). Presenting it as "Other" with its real value in
  // the text field means editing a book never silently rewrites it to English.
  const known = (LANGUAGES as readonly string[]).includes(language);
  const selectValue = known ? language : OTHER_LANGUAGE;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="ISBN" htmlFor="book-isbn" error={formState.errors.isbn?.message}>
          <IsbnField
            id="book-isbn"
            name="isbn"
            value={(useWatch({ control, name: "isbn" }) as string) ?? ""}
            onChange={(next) => setValue("isbn", next, { shouldDirty: true })}
            error={formState.errors.isbn?.message}
            disabled={disabled}
          />
        </Field>

        <Field
          label="Published year"
          error={formState.errors.publishedYear?.message}
          helper="Optional."
        >
          <Input
            type="number"
            inputMode="numeric"
            placeholder="1969"
            min={1000}
            max={new Date().getFullYear() + 1}
            disabled={disabled}
            aria-invalid={formState.errors.publishedYear ? true : undefined}
            {...register("publishedYear")}
          />
        </Field>

        <Field label="Publisher" error={formState.errors.publisher?.message} helper="Optional.">
          <Input
            placeholder="Ace Books"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={formState.errors.publisher ? true : undefined}
            {...register("publisher")}
          />
        </Field>

        <Field label="Edition" error={formState.errors.edition?.message} helper="Optional.">
          <Input
            placeholder="First edition"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={formState.errors.edition ? true : undefined}
            {...register("edition")}
          />
        </Field>

        <Field label="Pages" error={formState.errors.pageCount?.message} helper="Optional.">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="304"
            min={1}
            max={10000}
            disabled={disabled}
            aria-invalid={formState.errors.pageCount ? true : undefined}
            {...register("pageCount")}
          />
        </Field>

        <Field label="Language" error={formState.errors.language?.message}>
          <Select
            value={selectValue}
            onValueChange={(value) =>
              setValue("language", value === OTHER_LANGUAGE ? "" : value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger className="w-full" aria-label="Language">
              <SelectValue placeholder="Choose a language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_LANGUAGE}>Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Free-text language, shown only when "Other" is chosen. Deliberately a
          plain input rather than another chip field: it is one value, and the
          schema caps it at 60 characters. */}
      {selectValue === OTHER_LANGUAGE ? (
        <Field
          label="Language name"
          required
          error={formState.errors.language?.message}
          helper="Type the language, for example Welsh or Swahili."
        >
          <Input
            placeholder="Welsh"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={formState.errors.language ? true : undefined}
            {...register("language")}
          />
        </Field>
      ) : null}

      <Field
        label="Tags"
        htmlFor="book-tags"
        error={formState.errors.tags?.message}
        helper="Searchable keywords. Spaces become hyphens and everything is lowercased."
      >
        <TagInput
          id="book-tags"
          value={useWatch({ control, name: "tags" }) ?? []}
          onChange={(next) => setValue("tags", next, { shouldDirty: true })}
          disabled={disabled}
          invalid={Boolean(formState.errors.tags)}
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

export function BookInventorySection({
  form,
  disabled,
  onLoan,
}: SectionProps & {
  /** Copies already out on loan, from the loaded book. Zero when creating. */
  onLoan: number;
}) {
  const { register, control, formState } = form;
  const totalRaw = useWatch({ control, name: "totalCopies" });
  const total = toNumber(totalRaw);

  // Business rule 10: the total can never fall below what is out on loan. This is
  // the preview, not the guard — `min` on the input and the service both re-check,
  // because a client-side number is a hint, never a rule (invariant 4).
  const floor = onLoan;
  const belowFloor = total > 0 && total < floor;

  // Availability the service will compute: the total minus whatever is out.
  const available = Math.max(0, total - Math.min(onLoan, total));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Total copies"
          required
          error={formState.errors.totalCopies?.message}
          helper={
            floor > 0
              ? `${floor} ${floor === 1 ? "copy is" : "copies are"} currently on loan, so the total cannot go below ${floor}.`
              : "How many copies the library owns."
          }
        >
          {/* No `setValueAs`: react-hook-form already hands a number to a
                `type="number"` input, and the schema accepts `string | number`, so
                converting here would only add a second mechanism to keep in step
                with the validator. */}
          <Input
            type="number"
            inputMode="numeric"
            placeholder="5"
            min={Math.max(1, floor)}
            max={999}
            disabled={disabled}
            aria-invalid={belowFloor || Boolean(formState.errors.totalCopies) || undefined}
            {...register("totalCopies")}
          />
        </Field>

        <Field
          label="Shelf location"
          error={formState.errors.shelfLocation?.message}
          helper="Optional. Helps staff find it on the shelf."
        >
          <Input
            placeholder="A-12-3"
            autoComplete="off"
            className="font-mono text-code"
            disabled={disabled}
            aria-invalid={formState.errors.shelfLocation ? true : undefined}
            {...register("shelfLocation")}
          />
        </Field>
      </div>

      {/* Live availability, before saving. This is the number the catalog and
          the circulation desk both read, so showing it here removes the most
          common "why does it say 3 of 5?" support question. */}
      <div className={cn("space-y-3 rounded-lg border p-4", belowFloor ? "border-danger/40 bg-danger-soft/40" : "border-border bg-muted/40")}>
        <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
          Availability after saving
        </p>

        <CopiesBar available={available} total={total} />

        {floor > 0 ? (
          <p className={cn("text-caption", belowFloor ? "text-danger-ink" : "text-muted-foreground")}>
            {floor} {floor === 1 ? "copy is" : "copies are"} out on loan.
            {belowFloor
              ? " Raise the total back above the number on loan."
              : " Available copies adjust automatically."}
          </p>
        ) : (
          <p className="text-caption text-muted-foreground">
            All copies start available. Issuing a book reduces this number automatically.
          </p>
        )}
      </div>
    </div>
  );
}

/** Coerce a RHF number field to a usable integer, treating blanks as 0. */
function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? ""));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}