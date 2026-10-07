"use client";

import * as React from "react";
import { useCallback } from "react";
import { Check, Search, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { useRemoteCombobox } from "@/hooks/use-remote-combobox";
import { membersApi, type MemberSummary } from "@/lib/api-client";

/**
 * Member picker for the issue form (spec 12).
 *
 * **A hand-rolled combobox, not a `Select`.** The member is searched by name, email or
 * membership ID across potentially thousands of rows, so the control has to *filter
 * remotely*; a native select would need every member rendered up front. `GET
 * /api/members/lookup` was built in Unit 10 for exactly this.
 *
 * **The active-loan count rides along in each row.** The librarian's next question after
 * picking a member is "how many can they take?", and `lookupMembers` already returns
 * `activeLoans` — showing it here saves a round trip and lets the ticket's checklist be
 * computed without another query.
 *
 * All the awkward parts (debounce, abort, stale results, keyboard) live in
 * `useRemoteCombobox`; this component is only the presentation.
 *
 * `value` is lifted so the desk holds the selection — the issue ticket and its button read
 * it, and a deep link from a member's record can preselect someone.
 */
export function MemberSearchCombobox({
  value,
  onChange,
  autoFocus,
  className,
}: {
  value: MemberSummary | null;
  onChange: (member: MemberSummary | null) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const combo = useRemoteCombobox<MemberSummary>({
    query: useCallback((term, signal) => membersApi.lookup(term, signal), []),
    onChoose: useCallback(
      (member: MemberSummary) => {
        onChange(member);
        // Focus goes back to the field so the librarian can move straight to the book
        // rather than clicking back onto the page.
        inputRef.current?.focus();
      },
      [onChange],
    ),
  });

  /* ------------------------------- Selected ------------------------------- */
  if (value) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/40 p-4", className)}>
        <div className="flex items-center gap-3">
          <Avatar className="size-10 shrink-0">
            {value.avatar ? (
              <AvatarImage src={value.avatar.url} alt="" />
            ) : (
              <AvatarFallback className="bg-primary-soft text-small text-primary">
                {value.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-foreground">{value.name}</p>
            <p className="truncate text-caption text-muted-foreground">
              {value.membershipId ?? value.email}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={value.status} />
              <span className="text-caption text-muted-foreground">
                {value.activeLoans} out now
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Choose a different member"
            onClick={() => onChange(null)}
            className="shrink-0 text-muted-foreground"
          >
            <X className="size-4" strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  /* -------------------------------- Search -------------------------------- */
  const showEmpty = combo.open && !combo.tooShort && !combo.loading && combo.items.length === 0;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor="desk-member-search" className="text-small font-medium text-foreground">
        Member
      </label>
      <p className="mt-0.5 text-caption text-muted-foreground">
        Search by name, email or membership ID.
      </p>

      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          id="desk-member-search"
          ref={inputRef}
          value={combo.term}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={combo.open}
          aria-controls="desk-member-listbox"
          aria-autocomplete="list"
          placeholder="e.g. LIB-2026-0042 or Grace"
          onChange={(event) => combo.setTerm(event.target.value)}
          onFocus={() => combo.setOpen(true)}
          onBlur={() => {
            // Deferred so a click on a row lands before the list unmounts. `relatedTarget`
            // would be tidier but does not cover a click on the list's own scrollbar.
            window.setTimeout(() => combo.setOpen(false), 120);
          }}
          onKeyDown={combo.onKeyDown}
          className="pl-10"
        />
      </div>

      {/* A real `role="listbox"`. Focus stays in the input and the active option is
          conveyed visually, so `aria-activedescendant` would be ideal — but that needs the
          input to carry it, and the list is unmounted when closed, which leaves the
          reference dangling. A plain listbox with reachable buttons is honest and works. */}
      {combo.open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-border bg-popover shadow-lift">
          {combo.loading && combo.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-small text-muted-foreground">
              Searching…
            </p>
          ) : combo.tooShort ? (
            <p className="px-4 py-6 text-center text-small text-muted-foreground">
              Type at least two characters.
            </p>
          ) : showEmpty ? (
            <div className="px-2 py-1">
              <EmptyHint
                title="No member matches"
                description="Check the spelling, or search by membership ID."
              />
            </div>
          ) : (
            <ul
              id="desk-member-listbox"
              role="listbox"
              aria-label="Member results"
              className="max-h-72 overflow-y-auto p-1"
            >
              {combo.items.map((member, index) => {
                const active = index === combo.highlighted;

                return (
                  <li key={member.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      // `onMouseDown` + preventDefault so the row is chosen *before* the
                      // input's blur unmounts the list. `onClick` loses that race.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        combo.choose(member);
                      }}
                      onMouseEnter={() => combo.setHighlighted(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary-soft" : "hover:bg-muted",
                      )}
                    >
                      <Avatar className="size-8 shrink-0">
                        {member.avatar ? (
                          <AvatarImage src={member.avatar.url} alt="" />
                        ) : (
                          <AvatarFallback className="bg-muted text-caption text-muted-foreground">
                            {member.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-medium text-foreground">
                          {member.name}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground">
                          {member.membershipId ?? member.email}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-2">
                        {member.status !== "active" ? (
                          <StatusBadge status={member.status} />
                        ) : (
                          <span className="font-mono text-caption text-muted-foreground">
                            {member.activeLoans} out
                          </span>
                        )}
                        {active ? (
                          <Check
                            className="size-4 shrink-0 text-primary"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* Its own live region, deliberately **without** the listbox's id — duplicate ids
          make `aria-controls` ambiguous and break every AT that resolves it. */}
      <span aria-live="polite" className="sr-only">
        {combo.open && !combo.loading && !combo.tooShort && combo.items.length > 0
          ? `${combo.items.length} member${combo.items.length === 1 ? "" : "s"} found`
          : ""}
      </span>
    </div>
  );
}

/** A compact in-dropdown empty state — the full `EmptyState` is too tall for a listbox. */
function EmptyHint({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <UserRound className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="font-display text-h3 font-semibold text-foreground">{title}</p>
      <p className="max-w-64 text-caption text-muted-foreground">{description}</p>
    </div>
  );
}