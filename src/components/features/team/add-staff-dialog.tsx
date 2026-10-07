"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/common/form-alert";
import { TextField } from "@/components/features/auth/text-field";
import { RolePicker } from "@/components/features/team/role-picker";
import { generateTempPassword } from "@/lib/password-generator";
import { ApiRequestError, teamApi, toErrorMessage } from "@/lib/api-client";
import { createStaffMemberSchema, type CreateStaffMemberValues } from "@/lib/validators/members";
import type { CreateStaffMemberInput, TeamMember } from "@/lib/api-client";
import { PASSWORD_RULE_HINTS } from "@/lib/validators/auth";

/**
 * Create a staff account — librarian or administrator (F1, F6).
 *
 * **One dialog with an explicit role choice, not two buttons.** A second "Add
 * administrator" button in the header would create two entry points for one form, two
 * places for the copy to drift, and — worse — it would make creating an administrator
 * feel like a routine action rather than the deliberate grant of access it is. Picking
 * the role *inside* the dialog puts the capability difference in front of the person
 * making the decision, which is the whole point.
 *
 * **The temporary password is generated in the browser** and sent once, rather than being
 * generated server-side and shown afterwards. Two reasons:
 *
 * - the admin can see it before committing, so a mistyped email is caught before an
 *   account exists;
 * - the generator is a plain function over `crypto.getRandomValues`, so the same alphabet
 *   and the same "at least one letter and one digit" guarantee apply on both sides.
 *   `lib/password-generator.ts` is imported by this dialog *and* by the server service —
 *   one implementation, not two that can drift.
 *
 * Rendered only while open, so the form mounts fresh each time and `isDirty` is measured
 * against the values that were actually loaded.
 */
export function AddStaffDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (member: TeamMember) => void;
}) {
  if (!open) return null;

  return <AddStaffEditor onDone={() => onOpenChange(false)} onCreated={onCreated} />;
}

function AddStaffEditor({
  onDone,
  onCreated,
}: {
  onDone: () => void;
  onCreated: (member: TeamMember) => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<CreateStaffMemberValues, unknown, CreateStaffMemberInput>({
    resolver: zodResolver(createStaffMemberSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      // Seeded with a generated password so the account is usable immediately and the
      // admin does not have to invent one that satisfies the policy.
      password: generateTempPassword(),
      phone: "",
      // The safe default. Creating an administrator has to be a deliberate act.
      role: "librarian",
    },
  });

  const { register, handleSubmit, setValue, setError, control, formState } = form;

  // `useWatch` rather than `getValues`, so the role banner and the password row follow
  // the choice as it is made instead of on submit.
  const role = useWatch({ control, name: "role" }) ?? "librarian";

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      const member = await teamApi.create(values);
      toast.success(
        values.role === "admin" ? `${member.name} is now an administrator` : `${member.name} can now sign in`,
        {
          description:
            "Give them the temporary password and ask them to change it after signing in.",
        },
      );
      onCreated(member);
      onDone();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        if (error.fields.email) setError("email", { type: "server", message: error.fields.email });
        if (error.fields.password) {
          setError("password", { type: "server", message: error.fields.password });
        }
        if (!error.fields.email && !error.fields.password) setServerError(error.message);
        return;
      }
      setServerError(toErrorMessage(error, "We could not create that staff account."));
    }
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-6 pb-4 pr-14">
          <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
            Add a staff account
          </DialogTitle>
          <DialogDescription>
            Staff sign in with their own email address. A librarian runs the desk; an
            administrator can also change settings and manage other staff.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          {/* The only scrolling region, so the pinned footer is always reachable — the
              Unit 07 dialog bug. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-5">
            <FormAlert message={serverError} />

            <RolePicker
              value={role}
              onChange={(next) => setValue("role", next, { shouldDirty: true, shouldValidate: true })}
            />

            {/*
              Only shown for the privileged choice, and it states the consequence rather
              than implying one. An administrator can disable other staff and change the
              library settings, and the person handing out the account should know that
              while they are still typing, not afterwards.
            */}
            {role === "admin" ? (
              <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-small text-warning-ink">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  An administrator can change library settings and disable any other staff
                  account, including yours. Only give this to someone you trust with the
                  same authority you have.
                </span>
              </p>
            ) : null}

            <TextField
              name="name"
              label="Full name"
              autoComplete="off"
              placeholder="Grace Hopper"
              error={formState.errors.name}
              register={register}
              required
              autoFocus
            />

            <TextField
              name="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="grace.hopper@athenaeum.edu"
              error={formState.errors.email}
              register={register}
              required
            />

            <Field
              label="Phone"
              error={formState.errors.phone?.message}
              helper="Optional. Used only to reach the account holder."
            >
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+15550100"
                {...register("phone")}
              />
            </Field>

            <Field
              label="Temporary password"
              required
              error={formState.errors.password?.message}
              helper={PASSWORD_RULE_HINTS.join(" ")}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setValue("password", generateTempPassword(), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="-me-1"
                >
                  <Wand2 className="size-3.5" aria-hidden="true" />
                  Generate
                </Button>
              }
            >
              <Input
                type="text"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-code"
                {...register("password")}
              />
            </Field>

            <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-small text-warning-ink">
              This password is shown once, now. There is no email delivery, so write it down
              and hand it over directly.
            </p>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-surface px-6 py-4 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onDone}
              disabled={formState.isSubmitting}
              className="w-full sm:w-auto sm:me-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              // `isValid`, not `isDirty`: this form has no persisted record to differ
              // from, and the pre-filled password would otherwise make it permanently
              // dirty. The button tracks whether the form *can* be submitted.
              disabled={formState.isSubmitting || !formState.isValid}
              className="w-full sm:w-auto"
            >
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : role === "admin" ? (
                <>
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Create administrator
                </>
              ) : (
                <>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Create account
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
