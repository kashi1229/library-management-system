"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type FieldContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/**
 * Wraps a label + control + helper/error block so every form field in the app
 * follows the same anatomy (ui-context.md §Component Conventions): label above,
 * helper or error text below in muted-foreground / danger.
 */
function Field({
  label,
  htmlFor,
  helper,
  error,
  required,
  className,
  children,
  action,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Optional right-aligned control rendered next to the label. */
  action?: React.ReactNode;
}) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("space-y-2", className)}>
        {(label || action) && (
          <div className="flex items-baseline justify-between gap-3">
            {label ? (
              <label htmlFor={id} className="text-small font-medium text-foreground">
                {label}
                {required ? (
                  <span className="ml-0.5 text-accent" aria-hidden="true">
                    *
                  </span>
                ) : null}
              </label>
            ) : (
              <span />
            )}
            {action}
          </div>
        )}
        {children}
        {error ? (
          <p id={errorId} className="text-caption text-danger" role="alert">
            {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="text-caption text-muted-foreground">
            {helper}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Consumes the nearest `Field` so inputs wire their own id + aria automatically. */
export function useField(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

export { Field };
