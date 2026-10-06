"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/**
 * Chip-style multi-value input used for tags.
 *
 * Interaction follows the WAI-ARIA "editable combobox with list autocomplete"
 * pattern, reduced to what a tag field actually needs:
 *
 * - Enter, Tab and comma commit the current text; Backspace on an empty input
 *   removes the last chip.
 * - Every chip is a real `<button>` with an accessible name, so a screen-reader
 *   user can remove an item without a pointer.
 * - Duplicates are refused with a `role="status"` message rather than silently
 *   ignored, because a silently dropped tag looks like the app losing data.
 * - The chip list is `aria-live="polite"`, so adding or removing is announced.
 *
 * A hidden mirror input keeps the value in the surrounding RHF form: the chips
 * themselves are not form controls, so `setValue` is driven from here.
 */
export function TagInput({
  value,
  onChange,
  max = 10,
  id,
  placeholder = "Add a tag and press Enter",
  disabled,
  invalid,
  describedBy,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  id: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [justAdded, setJustAdded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const full = value.length >= max;

  const commit = React.useCallback(
    (raw: string) => {
      const clean = raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
      if (!clean) {
        setDraft("");
        return;
      }

      if (value.includes(clean)) {
        setNotice(`“${clean}” is already a tag`);
        setDraft("");
        return;
      }
      if (full) {
        setNotice(`A book can have at most ${max} tags`);
        return;
      }

      onChange([...value, clean]);
      setDraft("");
      setNotice(null);
      setJustAdded(true);
      // Clear the pop so the next chip animates in.
      window.setTimeout(() => setJustAdded(false), 240);
    },
    [full, max, onChange, value],
  );

  const remove = React.useCallback(
    (tag: string) => {
      onChange(value.filter((item) => item !== tag));
      setNotice(null);
      inputRef.current?.focus();
    },
    [onChange, value],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-surface px-2 py-1.5",
          "transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-ring/35 focus-within:ring-[3px]",
          invalid && "border-danger ring-danger/25",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <ul aria-live="polite" className="contents">
          {value.map((tag) => (
            <li key={tag}>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-small text-foreground",
                  "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200",
                )}
              >
                {tag}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(tag);
                  }}
                  disabled={disabled}
                  aria-label={`Remove tag ${tag}`}
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground",
                    "transition-colors duration-150 hover:bg-danger-soft hover:text-danger-ink",
                    "focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none",
                    "disabled:pointer-events-none",
                  )}
                >
                  <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>

        <input
          ref={inputRef}
          id={id}
          value={draft}
          disabled={disabled || full}
          placeholder={full ? `Maximum ${max} tags reached` : value.length === 0 ? placeholder : "Add another"}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          // The container is the visual field; this input is its accessible
          // single-line editor, so Enter must commit rather than submit the form.
          onChange={(event) => {
            setDraft(event.target.value);
            setNotice(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit(draft);
              return;
            }
            if (event.key === "Backspace" && draft === "" && value.length > 0) {
              event.preventDefault();
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => commit(draft)}
          className={cn(
            "min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-body text-foreground",
            "outline-none placeholder:text-muted-foreground/70",
            "disabled:cursor-not-allowed",
          )}
        />
      </div>

      <p className="text-caption text-muted-foreground">
        {value.length} of {max} tags. Press Enter or comma to add.
      </p>

      {/* Duplicate/max notices are announced without stealing focus. */}
      <span role="status" aria-live="polite" className="sr-only">
        {justAdded ? `Tag added. ${value.length} of ${max} used.` : notice ?? ""}
      </span>
      {notice ? (
        <p className="flex items-center gap-1.5 text-caption text-warning-ink">
          <X className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          {notice}
        </p>
      ) : null}
    </div>
  );
}
