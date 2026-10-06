"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/**
 * Chip-style author input.
 *
 * Same interaction as `TagInput`, but with two differences that matter:
 *
 * - Commits on **Blur** as well as Enter, because a name typed and then Tabbed
 *   past would otherwise be silently lost. Tags can afford to lose a draft;
 *   losing an author's surname cannot.
 * - Order is preserved and **no duplicates are refused**, since two different
 *   people really can share a name, and co-authors legitimately repeat a surname.
 */
export function AuthorsInput({
  value,
  onChange,
  id,
  placeholder = "Add an author and press Enter",
  disabled,
  invalid,
  describedBy,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  id: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commit = React.useCallback(
    (raw: string) => {
      // Collapse internal whitespace so "Ursula  K. Le Guin" stores tidily.
      const clean = raw.trim().replace(/\s+/g, " ");
      if (!clean) {
        setDraft("");
        return;
      }
      onChange([...value, clean]);
      setDraft("");
    },
    [onChange, value],
  );

  const remove = React.useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
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
        <ul className="contents">
          {value.map((author, index) => (
            <li key={`${author}-${index}`}>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pr-1 pl-2.5 text-small text-foreground">
                {author}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(index);
                  }}
                  disabled={disabled}
                  aria-label={`Remove author ${author}`}
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
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : "Add another author"}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit(draft);
              return;
            }
            if (event.key === "Backspace" && draft === "" && value.length > 0) {
              event.preventDefault();
              remove(value.length - 1);
            }
          }}
          onBlur={() => commit(draft)}
          className={cn(
            "min-w-[10rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-body text-foreground",
            "outline-none placeholder:text-muted-foreground/70",
            "disabled:cursor-not-allowed",
          )}
        />
      </div>

      <p className="text-caption text-muted-foreground">
        {value.length === 0
          ? "At least one author is required."
          : `${value.length} ${value.length === 1 ? "author" : "authors"}. Press Enter or comma to add.`}
      </p>
    </div>
  );
}
