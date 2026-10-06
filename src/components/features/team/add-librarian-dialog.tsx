"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus, Wand2 } from "lucide-react";
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
import { generateTempPassword } from "@/lib/password-generator";
import { ApiRequestError, teamApi, toErrorMessage } from "@/lib/api-client";
import { createLibrarianSchema } from "@/lib/validators/members";
import type { CreateLibrarianInput, TeamMember } from "@/lib/api-client";
import { PASSWORD_RULE_HINTS } from "@/lib/validators/auth";

/**
 * Create a librarian account (spec 10).
 *
 * The temporary password is **generated in the browser** and sent once, rather than
 * being generated server-side and shown afterwards. Two reasons:
 *
 * - the admin can see it before committing, so a mistyped email is caught before an
 *   account exists;
 * - the generator is a plain function over `crypto.getRandomValues`, so the same
 *   alphabet and the same "at least one letter and one digit" guarantee apply on both
 *   sides. `lib/password-generator.ts` is imported by both the client dialog and the
 *   server service — one implementation, not two that can drift.
 *
 * Rendered only while open and keyed, so the form mounts fresh each time.
 */
export function AddLibrarianDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (member: TeamMember) => void;
}) {
  if (!open) return null;

  return <AddLibrarianEditor onDone={() => onOpenChange(false)} onCreated={onCreated} />;
}

function AddLibrarianEditor({
  onDone,
  onCreated,
}: {
  onDone: () => void;
  onCreated: (member: TeamMember) => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<
    { name: string; email: string; password: string },
    unknown,
    CreateLibrarianInput
  >({
    resolver: zodResolver(createLibrarianSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      // Seeded with a generated password so the account is usable immediately and the
      // admin does not have to invent one that satisfies the policy.
      password: generateTempPassword(),
    },
  });

  const { register, handleSubmit, setValue, setError, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      const member = await teamApi.create(values);
      toast.success(`${member.name} can now sign in`, {
        description: `Give them the temporary password and ask them to change it after signing in.`,
      });
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
      setServerError(toErrorMessage(error, "We could not create that librarian account."));
    }
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-6 pb-4 pr-14">
          <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
            Add a librarian
          </DialogTitle>
          <DialogDescription>
            A librarian can manage books, members, reservations and fines. They cannot change
            library settings or manage staff accounts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          {/* The only scrolling region. Capped at 100dvh so a laptop viewport cannot
              push the footer off the bottom — the Unit 07 dialog bug. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-5">
            <FormAlert message={serverError} />

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
              This password is shown once, now. There is no email delivery, so write it down and
              hand it over directly.
            </p>
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t border-border bg-surface px-6 py-4">
            <Button type="button" variant="outline" onClick={onDone} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating…
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