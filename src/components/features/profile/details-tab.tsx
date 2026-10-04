"use client";

import * as React from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Mail, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/common/form-alert";
import { TextField, AUTH_ICONS } from "@/components/features/auth/text-field";
import { ApiRequestError, profileApi, toErrorMessage } from "@/lib/api-client";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validators/profile";
import { DEPARTMENTS } from "@/lib/constants";
import type { PublicUser } from "@/types";

const OTHER = "__other__";

/**
 * Editable details: name, phone and department.
 *
 * Email, membership ID, role and status are read-only (F2) and are shown with a
 * lock so it is clear they are deliberate, not an oversight. They are also
 * absent from the update schema, so they cannot be written from the client.
 */
export function DetailsTab({
  user,
  onUpdated,
}: {
  user: PublicUser;
  onUpdated: (user: PublicUser) => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const [department, setDepartment] = React.useState<string>(
    DEPARTMENTS.some((d) => d.value === user.department) ? (user.department as string) : OTHER,
  );
  const [customDepartment, setCustomDepartment] = React.useState(
    user.department && !DEPARTMENTS.some((d) => d.value === user.department) ? user.department : "",
  );

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    mode: "onBlur",
    defaultValues: {
      name: user.name,
      phone: user.phone ?? undefined,
      department: user.department ?? undefined,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    setSaved(false);

    const resolvedDepartment =
      department === OTHER ? customDepartment.trim() || undefined : department;

    try {
      const { user: updated } = await profileApi.update({
        name: values.name,
        phone: values.phone,
        department: resolvedDepartment,
        // Omitted entirely, so the avatar is left untouched by a details save.
      });
      onUpdated(updated);
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        for (const [name, message] of Object.entries(error.fields)) {
          form.setError(name as FieldPath<UpdateProfileInput>, { type: "server", message });
        }
        if (!Object.keys(error.fields).length) setServerError(error.message);
        return;
      }
      setServerError(toErrorMessage(error, "We could not save your changes."));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">Details</CardTitle>
        <CardDescription>
          Your name appears on loan records and reservations. Phone is used only for overdue reminders.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <FormAlert message={serverError} />

          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              name="name"
              label="Full name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              icon={AUTH_ICONS.name}
              error={form.formState.errors.name}
              register={form.register}
              required
            />

            <TextField
              name="phone"
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              icon={AUTH_ICONS.phone}
              hint="Optional."
              error={form.formState.errors.phone}
              register={form.register}
            />

            <div className="md:col-span-2">
              <Field label="Department" helper="Optional — helps us tailor recommendations.">
                <Input
                  value={department === OTHER ? customDepartment : department}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDepartment(next);
                    if (next === OTHER) setCustomDepartment("");
                    form.setValue("department", next === OTHER ? undefined : next);
                  }}
                  list="department-options"
                  placeholder="Select or type your department"
                  autoComplete="organization"
                />
                <datalist id="department-options">
                  {DEPARTMENTS.map((option) => (
                    <option key={option.value} value={option.value} />
                  ))}
                </datalist>
              </Field>
            </div>
          </div>

          {/* ------------------------- Read-only fields ------------------------- */}
          <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
            <p className="flex items-center gap-1.5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              <Lock className="size-3.5" strokeWidth={1.75} />
              Managed by the library
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <ReadOnlyField icon={Mail} label="Email" value={user.email} />
              <ReadOnlyField
                icon={Lock}
                label="Membership ID"
                value={user.membershipId ?? "Not applicable"}
                mono={Boolean(user.membershipId)}
              />
              <ReadOnlyField icon={Lock} label="Role" value={user.role} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save changes
                </>
              )}
            </Button>
            {/* Announced politely so the confirmation is not visual-only. */}
            <span aria-live="polite" className="text-small text-success-ink">
              {saved ? "Changes saved." : ""}
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ReadOnlyField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.75} />
        {label}
      </p>
      <p className={cn("truncate text-foreground", mono ? "font-mono text-code" : "text-small")}>{value}</p>
    </div>
  );
}

function cn(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}
