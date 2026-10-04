"use client";

import * as React from "react";
import type { FieldError, FieldPath, FieldValues, UseFormRegister } from "react-hook-form";
import { Mail, Lock, User, Phone, GraduationCap, BookOpen, type LucideIcon } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * A labelled text input wired to react-hook-form.
 *
 * The label, the control and the message are generated here so every field in
 * the app shares one anatomy: label above, 44px control, message below, and
 * correct `id` / `aria-invalid` for assistive technology. Pass `control` to
 * swap in a different input (for example `PasswordInput`).
 */
export type TextFieldProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: FieldError;
  type?: React.HTMLInputTypeAttribute;
  icon?: LucideIcon;
  placeholder?: string;
  hint?: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
  /** Replaces the default `Input` while keeping all the wiring above. */
  control?: React.ComponentType<React.ComponentProps<"input">>;
};

export function TextField<T extends FieldValues>({
  name,
  label,
  register,
  error,
  type = "text",
  icon: Icon,
  placeholder,
  hint,
  required,
  autoComplete,
  autoFocus,
  inputMode,
  className,
  control: Control,
}: TextFieldProps<T>) {
  // An icon inside the control would sit under the text, so pad the control —
  // including a custom one, which must reserve the same room as `Input` does.
  const padded = Boolean(Icon);

  return (
    <Field label={label} helper={hint} error={error?.message} required={required} className={className}>
      <div className="relative">
        {Icon ? (
          <Icon
            aria-hidden="true"
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          />
        ) : null}
        {Control ? (
          <Control
            type={type}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            inputMode={inputMode}
            aria-invalid={error ? true : undefined}
            // Custom controls must reserve the same room for the icon as Input does.
            className={padded ? "pl-10" : undefined}
            {...register(name)}
          />
        ) : (
          <Input
            type={type}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            inputMode={inputMode}
            aria-invalid={error ? true : undefined}
            className={padded ? "pl-10" : undefined}
            {...register(name)}
          />
        )}
      </div>
    </Field>
  );
}

/** Icon set shared by the auth forms, kept in one place for consistency. */
export const AUTH_ICONS = {
  name: User,
  email: Mail,
  password: Lock,
  phone: Phone,
  department: GraduationCap,
  confirmPassword: Lock,
  category: BookOpen,
} satisfies Record<string, LucideIcon>;
