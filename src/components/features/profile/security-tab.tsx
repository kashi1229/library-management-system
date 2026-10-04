"use client";

import * as React from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/common/form-alert";
import { TextField, AUTH_ICONS } from "@/components/features/auth/text-field";
import { PasswordInput } from "@/components/features/auth/password-input";
import { PasswordStrength } from "@/components/features/auth/password-strength";
import { ApiRequestError, authApi, toErrorMessage } from "@/lib/api-client";
import { changePasswordSchema, PASSWORD_RULE_HINTS, type ChangePasswordInput } from "@/lib/validators/auth";

/**
 * Security tab: change password.
 *
 * Requires the current password (F2). On success the form resets so the new
 * password is never left sitting in a DOM field.
 */
export function SecurityTab() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  // `useWatch` is the memo-safe way to read one field.
  const newPassword = useWatch({ control: form.control, name: "newPassword" });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    setDone(false);

    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      form.reset();
      setDone(true);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        for (const [name, message] of Object.entries(error.fields)) {
          form.setError(name as FieldPath<ChangePasswordInput>, { type: "server", message });
        }
        if (!Object.keys(error.fields).length) setServerError(error.message);
        return;
      }
      setServerError(toErrorMessage(error, "We could not change your password."));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">Password</CardTitle>
        <CardDescription>
          Choose something you do not use anywhere else. You will stay signed in on this device.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="max-w-md space-y-6">
          <FormAlert message={serverError} />

          <TextField
            name="currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={AUTH_ICONS.password}
            error={form.formState.errors.currentPassword}
            register={form.register}
            required
            control={PasswordInput}
          />

          <div className="space-y-2">
            <TextField
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a new password"
              icon={KeyRound}
              error={form.formState.errors.newPassword}
              register={form.register}
              required
              control={PasswordInput}
            />
            <PasswordStrength password={newPassword ?? ""} />
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
              {PASSWORD_RULE_HINTS.map((hint) => (
                <li key={hint} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1 rounded-full bg-muted-foreground/50" />
                  {hint}
                </li>
              ))}
            </ul>
          </div>

          <TextField
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            icon={AUTH_ICONS.confirmPassword}
            error={form.formState.errors.confirmPassword}
            register={form.register}
            required
            control={PasswordInput}
          />

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Updating…
                </>
              ) : (
                "Change password"
              )}
            </Button>
            <span aria-live="polite" className="text-small text-success-ink">
              {done ? "Password changed." : ""}
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
