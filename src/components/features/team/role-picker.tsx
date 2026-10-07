"use client";

import * as React from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { STAFF_ROLES, type StaffRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * What each staff role can actually do, in the words a librarian would use.
 *
 * Kept beside the picker rather than inside it so the strings are editable in one place,
 * and written as **capabilities** ("can") rather than as denials. "Cannot manage staff" is
 * also true, but listing an absence of power is less useful to someone deciding than
 * listing what the account will be able to reach.
 */
const ROLE_COPY: Record<
  StaffRole,
  {
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    can: string[];
  }
> = {
  librarian: {
    label: "Librarian",
    icon: BookOpen,
    can: [
      "Manage books, categories and covers",
      "Serve members at the circulation desk",
      "Raise, waive and collect fines",
      "Manage holds and reservations",
    ],
  },
  admin: {
    label: "Administrator",
    icon: ShieldCheck,
    can: [
      "Everything a librarian can do",
      "Change library settings and loan policy",
      "Create, rename and disable staff accounts",
      "Read the audit log and run reports",
    ],
  },
};

/**
 * Role chooser for the staff dialog.
 *
 * **Native `<input type="radio">`, not a grid of buttons.** The browser already implements
 * everything an ARIA radiogroup promises here: one tab stop for the group, arrow keys to
 * move between options, and a correct accessibility tree. `useRovingRadio` exists for
 * *styled button* grids that have to supply that behaviour themselves — pairing it with
 * real radios would handle every arrow keypress twice and leave the two implementations
 * arguing about which option is selected.
 *
 * The input is `sr-only` and the whole card is a `<label>`, so:
 *
 * - the click target is the card, not a 12px radio dot, which is well under the 40px
 *   pointer minimum;
 * - the selected and focused states are drawn with `has-[:checked]` / `has-[:focus-visible]`
 *   on the label, so they follow the real input rather than a duplicated React state that
 *   could disagree with it;
 * - focus lands on the real input, so Space toggles it and a screen reader announces the
 *   group and the option.
 */
export function RolePicker({
  value,
  onChange,
}: {
  value: StaffRole;
  onChange: (next: StaffRole) => void;
}) {
  // Stable ids, index-aligned with `STAFF_ROLES`, so the label/input pairing never drifts.
  const ids = React.useMemo(() => STAFF_ROLES.map((role) => `staff-role-${role}`), []);

  return (
    <fieldset>
      <legend className="text-small font-medium text-foreground">Role</legend>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {STAFF_ROLES.map((role, index) => {
          const { label, icon: Icon, can } = ROLE_COPY[role];
          const selected = role === value;
          const inputId = ids[index];

          return (
            <label
              key={role}
              htmlFor={inputId}
              className={cn(
                "flex cursor-pointer flex-col rounded-lg border p-4 transition-colors",
                "has-[:focus-visible]:ring-ring/45 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:outline-none",
                selected
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-surface hover:bg-muted/40",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name="staff-role"
                value={role}
                checked={selected}
                onChange={() => onChange(role)}
                className="sr-only"
              />

              <div className="flex items-center gap-2">
                {/* The icon tile is the selected-state cue. The border colour and tint are
                    the second cue, so the choice never rests on colour alone. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>

                <span
                  className={cn(
                    "text-small font-semibold",
                    selected ? "text-primary" : "text-foreground",
                  )}
                >
                  {label}
                </span>
              </div>

              <ul className="mt-3 space-y-1">
                {can.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-1.5 text-caption text-muted-foreground"
                  >
                    <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                    {line}
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
