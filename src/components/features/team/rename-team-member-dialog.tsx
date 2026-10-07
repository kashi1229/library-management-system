"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/common/form-alert";
import { StatusBadge } from "@/components/common/status-badge";
import { initials } from "@/lib/utils";
import { ApiRequestError, teamApi, toErrorMessage } from "@/lib/api-client";
import {
  renameTeamMemberSchema,
  type RenameTeamMemberInput,
  type RenameTeamMemberValues,
} from "@/lib/validators/members";
import type { TeamMember } from "@/lib/api-client";

/**
 * Rename a staff account (spec 10).
 *
 * **This replaces a `window.prompt`.** The original version was one line of
 * `window.prompt("New name for this staff account:", member.name)` guarded by a length
 * check and a `toast.error` for anything shorter. It was wrong in four ways:
 *
 * 1. **It looked like a browser dialog inside the app.** An OS-native prompt cannot be
 *    styled, so it broke the Parchment & Ink theme at the exact moment the admin is
 *    editing staff.
 * 2. **No field-level validation.** Too short, or all whitespace, produced a toast after
 *    the fact rather than a message under the input.
 * 3. **No discard guard.** `prompt` throws the typed text away on cancel with no warning,
 *    and Escape discards silently.
 * 4. **No context.** It asked for a name without showing whose name, or reminding the
 *    admin that the name is what appears in the sidebar and the audit trail.
 *
 * Follows the `CategoryDialog` pattern exactly, because that one was already fixed for
 * three separate Unit 07 bugs and re-deriving it here would only invite the same three:
 *
 * - rendered only while open and **keyed by member id**, so initial values come from props
 *   with no reset effect and `isDirty` reliably means "differs from what was loaded";
 * - one scrolling region with a **pinned action footer**, so Save is reachable at 1024×640
 *   (`DialogContent` centres itself with `translate-y-[-50%]` and has no height cap);
 * - every close path routes through `requestClose()`, and the discard prompt is a **pinned
 *   row under the header**, never a second modal (nesting one strands focus) and never a
 *   swap for the footer (unmounting the form's only submit button lets a real click on
 *   "Keep editing" fall into implicit submission and save the record);
 * - Save is disabled until the form is dirty, so its state tells the admin whether there
 *   is anything to save.
 */
export function RenameTeamMemberDialog({
  open,
  onOpenChange,
  member,
  onRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onRenamed: (member: TeamMember) => void;
}) {
  if (!open || !member) return null;

  return (
    <RenameEditor
      key={member.id}
      member={member}
      onDone={() => onOpenChange(false)}
      onRenamed={onRenamed}
    />
  );
}

function RenameEditor({
  member,
  onDone,
  onRenamed,
}: {
  member: TeamMember;
  onDone: () => void;
  onRenamed: (member: TeamMember) => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const form = useForm<RenameTeamMemberValues, unknown, RenameTeamMemberInput>({
    resolver: zodResolver(renameTeamMemberSchema),
    mode: "onBlur",
    defaultValues: { name: member.name },
  });

  const { register, handleSubmit, formState, setError, control } = form;
  const isDirty = formState.isDirty;

  // `useWatch` rather than `getValues`, so the preview re-renders on every keystroke
  // instead of only on the next submit.
  const draftName = useWatch({ control, name: "name" });
  const previewName = draftName?.trim() || member.name;
  const unchanged = previewName === member.name;

  /** Any close path lands here, so dirty input is never dropped silently. */
  const requestClose = React.useCallback(() => {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onDone();
  }, [isDirty, onDone]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    // Zod already trimmed and range-checked this, and the schema rejects a name equal in
    // substance to nothing. Guarding the no-op here means the button can never be pressed
    // for a change that does not exist.
    if (values.name === member.name) {
      onDone();
      return;
    }

    try {
      const updated = await teamApi.update(member.id, { name: values.name });
      toast.success("Name updated", {
        description: `${member.name} is now ${updated.name}.`,
      });
      onRenamed(updated);
      onDone();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields?.name) {
        setError("name", { type: "server", message: error.fields.name });
        return;
      }
      setServerError(toErrorMessage(error, "We could not change this staff member's name."));
    }
  });

  return (
    <Dialog open onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          requestClose();
        }}
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-6 pb-4 pr-14">
          <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
            Rename staff account
          </DialogTitle>
          <DialogDescription>
            This is the name colleagues see in the sidebar, on books they add, and in the
            audit trail. The email address does not change.
          </DialogDescription>
        </DialogHeader>

        {/* A pinned row, not a nested dialog and not a replacement for the footer. */}
        {confirmDiscard ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-y border-border bg-warning-soft px-6 py-3">
            <p className="min-w-0 flex-1 text-small font-medium text-warning-ink">
              Discard the new name?
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={onDone}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          {/* The only scrolling region. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-5">
            <FormAlert message={serverError} />

            {/* ------------------------- Live preview ------------------------- */}
            {/*
              The avatar updates as you type, initials included, because the initials are
              derived from the name and a two-word name is where they go wrong. Showing the
              result is cheaper than explaining the rule.
            */}
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <Avatar className="size-11 shrink-0">
                {member.avatar ? (
                  <AvatarImage src={member.avatar.url} alt="" />
                ) : (
                  <AvatarFallback
                    className={
                      unchanged
                        ? "bg-primary-soft text-small text-primary"
                        : "bg-accent-soft text-small text-accent-ink"
                    }
                  >
                    {initials(previewName)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold text-foreground">
                  {previewName}
                </p>
                <p className="truncate text-caption text-muted-foreground">{member.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={member.role === "admin" ? "info" : "secondary"}>
                    {member.role === "admin" ? "Administrator" : "Librarian"}
                  </Badge>
                  <StatusBadge status={member.status} />
                </div>
              </div>
            </div>

            <Field
              label="Full name"
              required
              error={formState.errors.name?.message}
              helper="At least 2 characters. Trailing spaces are removed automatically."
            >
              <Input
                autoComplete="off"
                autoFocus
                maxLength={80}
                placeholder={member.name}
                {...register("name")}
              />
            </Field>

            {/* ------------------------ Read-only facts ----------------------- */}
            {/*
              The email and role are shown rather than hidden, because an admin renaming
              someone is usually trying to fix a colleague's details and "why can't I
              change the email here?" is the obvious next question. Same reasoning as the
              locked read-only fields on the profile page.
            */}
            <dl className="space-y-2 rounded-md border border-border bg-surface p-4 text-small">
              <LockedRow
                icon={Mail}
                label="Email"
                value={member.email}
                hint="Only changeable by the account holder."
              />
              <LockedRow
                icon={ShieldCheck}
                label="Role"
                value={member.role === "admin" ? "Administrator" : "Librarian"}
                hint="Set when the account is created, and not editable."
              />
            </dl>
          </div>

          {/* --------------------------- Action row --------------------------- */}
          {/*
            `DialogFooter` is `flex-col-reverse sm:flex-row`, so on mobile the DOM order
            (Cancel, Save) renders as Save on top of Cancel. That is the right order — the
            primary action sits under the thumb — but `me-auto` from `CategoryDialog` then
            applies to the *column* axis and strands a narrow Cancel at the bottom left
            instead of a full-width one. So the push is desktop-only here, and both buttons
            fill the column on mobile where there is room for a proper tap target.
          */}
          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-surface px-6 py-4 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              className={`w-full sm:w-auto ${isDirty ? "sm:me-auto" : ""}`}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={formState.isSubmitting || !isDirty || confirmDiscard}
              className="w-full sm:w-auto"
            >
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                "Save name"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LockedRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <dt className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-caption text-muted-foreground">{label}</span>
          <span className="truncate text-foreground">{value}</span>
        </dt>
        <dd className="text-caption text-muted-foreground">{hint}</dd>
      </div>
    </div>
  );
}
