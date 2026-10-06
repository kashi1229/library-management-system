"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { membersApi, type MemberSummary } from "@/lib/api-client";

/**
 * Reset a password (spec 10).
 *
 * Two steps, because they have genuinely different risks:
 *
 * 1. **Confirm** — an irreversibly destructive action that will sign the member out,
 *    so it goes through `ConfirmDialog` with its consequence spelled out.
 * 2. **Reveal** — the generated password, shown exactly once with a copy button.
 *
 * The reveal step is the important one. The plaintext is never stored, so **this is
 * the only time it exists anywhere**; closing the dialog loses it permanently and the
 * only way forward is another reset. That is stated on the screen rather than left for
 * the user to discover, and the value is selectable and focusable so a screen reader
 * can reach it.
 */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberSummary | null;
}) {
  const [pending, setPending] = React.useState(false);
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  /**
   * Set synchronously the moment a reset succeeds, and read by the confirm step's
   * close handler. A ref rather than `revealed` itself because the handler that reads
   * it is **stale by construction**:
   *
   * `ConfirmDialog.handleConfirm` captured `onOpenChange` from the render in which the
   * button was clicked, then awaits `onConfirm()` and calls `onOpenChange(false)`. By
   * then `revealed` in *that closure* is still `null`, because React has not re-rendered
   * — so reading `revealed` there would take the "the user cancelled" branch and wipe
   * the password before the reveal dialog ever opened.
   *
   * That is exactly the bug this component shipped with: the reset succeeded, the toast
   * fired, the password was set, and then the confirm dialog's own auto-close destroyed
   * it. Nothing appeared and nothing errored. A ref written in the same tick is immune
   * to the staleness.
   */
  const revealedRef = React.useRef(false);

  // Reset the transient state whenever the dialog is closed, so reopening it never
  // shows the previous member's password.
  const close = React.useCallback(() => {
    revealedRef.current = false;
    setRevealed(null);
    setCopied(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const reset = React.useCallback(async () => {
    if (!member) return;

    setPending(true);

    try {
      const result = await membersApi.resetPassword(member.id);

      // The ref goes first: it has to be true before `ConfirmDialog` fires its
      // auto-close, which happens as soon as this function returns.
      revealedRef.current = true;
      setRevealed(result.temporaryPassword);

      toast.success(`New password for ${result.user.name}`, {
        description: "Shown once. Copy it now, it cannot be retrieved later.",
      });
    } catch {
      // A toast, not inline state: `ConfirmDialog` closes itself as soon as
      // `onConfirm` settles, so an error held in state would be unmounted before it
      // ever painted and the failure would look like nothing happened.
      toast.error("We could not reset that password", {
        description: "Nothing was changed. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }, [member]);

  const copy = async () => {
    if (!revealed) return;

    try {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the value is selectable, so say so rather than
      // failing silently.
      toast.error("Could not copy automatically", {
        description: "Select the password above and copy it manually.",
      });
    }
  };

  return (
    <>
      <ConfirmDialog
        open={open && revealed === null}
        onOpenChange={(next) => {
          // Two ways this fires, and they mean opposite things:
          //
          // - the user cancelled, so tear everything down; but
          // - the reset just succeeded, and `ConfirmDialog` closes itself as soon as
          //   `onConfirm` returns. That is not a dismissal and must not touch `revealed`.
          if (next) return;
          if (revealedRef.current) return;
          if (!pending) close();
        }}
        title={`Reset ${member?.name ?? "this member"}'s password?`}
        consequence="A new password will be generated immediately. Their current password stops working and any device still signed in will have to sign in again."
        confirmLabel="Reset password"
        onConfirm={reset}
      />

      <Dialog
        open={revealed !== null}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="mb-1 grid size-11 place-items-center rounded-full bg-warning-soft text-warning-ink">
              <KeyRound className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
              Temporary password
            </DialogTitle>
            <DialogDescription>
              Give this to {member?.name ?? "the member"} directly. Ask them to change it after
              signing in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
              {/* `select-all` and a mono face: the value has to be readable character by
                  character and easy to grab, because it is being copied by hand. */}
              <code
                className="min-w-0 flex-1 select-all break-all font-mono text-h3 text-foreground"
                aria-label="Temporary password"
              >
                {revealed}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label={copied ? "Password copied" : "Copy password"}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-4 text-success-ink" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>

            <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-small text-warning-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>
                This is the only time it will be shown. Once you close this, the password cannot be
                retrieved and you will have to reset it again.
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button onClick={close}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}