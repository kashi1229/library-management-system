"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/common/form-alert";
import { ApiRequestError, membersApi, toErrorMessage } from "@/lib/api-client";
import { suspendMemberSchema } from "@/lib/validators/members";
import type { MemberSummary } from "@/lib/api-client";

/**
 * Suspend a member (spec 10).
 *
 * **The reason is required and it is the point of the dialog.** It is stored, audited
 * and sent to the member as a notification, and it is the only thing they will see.
 * A dialog that said "suspend this member?" and nothing else would produce
 * "my account is suspended" with no path forward — the most common complaint a
 * library desk receives about suspensions.
 *
 * Rendered only while open, and keyed by member id, so the form mounts fresh each
 * time: initial values come from props with no reset effect, and `isDirty` reliably
 * means "differs from what was loaded".
 */
export function SuspendDialog({
  open,
  onOpenChange,
  member,
  onSuspended,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberSummary | null;
  onSuspended: (member: MemberSummary) => void;
}) {
  if (!open || !member) return null;

  return (
    <SuspendEditor
      key={member.id}
      member={member}
      onDone={() => onOpenChange(false)}
      onSuspended={onSuspended}
    />
  );
}

function SuspendEditor({
  member,
  onDone,
  onSuspended,
}: {
  member: MemberSummary;
  onDone: () => void;
  onSuspended: (member: MemberSummary) => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<{ reason: string }, unknown, { reason: string }>({
    resolver: zodResolver(suspendMemberSchema),
    mode: "onBlur",
    defaultValues: { reason: "" },
  });

  const { register, handleSubmit, formState, setError } = form;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      const updated = await membersApi.suspend(member.id, values.reason);
      toast.success(`${updated.name} is suspended`, {
        description: "They can still sign in and read, but cannot borrow or reserve.",
      });
      onSuspended({ ...member, ...updated });
      onDone();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields?.reason) {
        setError("reason", { type: "server", message: error.fields.reason });
        return;
      }
      setServerError(toErrorMessage(error, "We could not suspend this member."));
    }
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <span className="mb-1 grid size-11 place-items-center rounded-full bg-danger-soft text-danger-ink">
            <ShieldAlert className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
            Suspend {member.name}?
          </DialogTitle>
          <DialogDescription>
            They will be signed out of borrowing: no new loans, renewals or reservations. They can
            still sign in, read the catalog and manage their profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormAlert message={serverError} />

          <Field
            label="Reason"
            required
            error={formState.errors.reason?.message}
            helper="The member sees this on their next sign-in, so make it something they can act on."
          >
            <Textarea
              rows={3}
              autoFocus
              placeholder="Unreturned books overdue by more than 30 days; desk will explain on request."
              {...register("reason")}
            />
          </Field>

          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={onDone} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Suspending…
                </>
              ) : (
                "Suspend access"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}