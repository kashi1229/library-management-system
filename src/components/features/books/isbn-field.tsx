"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Check, CircleAlert } from "lucide-react";
import { isValidIsbn, normalizeIsbn } from "@/lib/validators/book";

/**
 * ISBN field with **live** validity feedback.
 *
 * The check runs as the user types, but only once the field could plausibly be
 * complete (10 or 13 characters after normalisation), so it never nags
 * mid-keystroke. The icon is `aria-hidden` and the state is announced through the
 * field's `aria-describedby` instead, which is what a screen reader actually
 * reads while typing.
 *
 * A duplicate ISBN is a *server* conflict, so it arrives as a field error after
 * submit rather than from this component.
 */
export function IsbnField({
  value,
  onChange,
  id,
  name = "isbn",
  error,
  disabled,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  id: string;
  /**
   * Form field name. The input is fully controlled rather than `register`ed — the
   * live validity check has to see every keystroke — so the name is passed
   * explicitly. Without it the control is invisible to form semantics, to browser
   * autofill, and to any test that locates fields by name.
   */
  name?: string;
  /** Server-side error, e.g. "Another book already uses that ISBN". */
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  const hintId = `${id}-hint`;
  const normalized = normalizeIsbn(value);

  const complete = normalized.length === 10 || normalized.length === 13;
  const valid = complete && isValidIsbn(normalized);
  // Only complain once the length says the user has finished typing.
  const invalidChecksum = complete && !valid;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="978-0-441-01359-3"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error) || invalidChecksum || undefined}
          aria-describedby={cn(error ? `${id}-error` : undefined, hintId) || undefined}
          className={cn("pr-11 font-mono text-code", valid && "pr-11 border-success/60")}
        />
        {valid ? (
          <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-success-ink">
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            <span className="sr-only">Valid ISBN</span>
          </span>
        ) : invalidChecksum ? (
          <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-danger-ink">
            <CircleAlert className="size-4" strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Invalid ISBN</span>
          </span>
        ) : null}
      </div>

      <p
        id={hintId}
        className={cn(
          "text-caption",
          invalidChecksum ? "text-danger-ink" : "text-muted-foreground",
        )}
      >
        {invalidChecksum
          ? "That ISBN fails its check digit. Double-check the number."
          : valid
            ? `Valid ISBN-${normalized.length === 10 ? "10" : "13"}.`
            : "Optional. 10 or 13 digits; hyphens are fine."}
      </p>
    </div>
  );
}
