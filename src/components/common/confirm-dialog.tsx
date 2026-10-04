"use client";

import * as React from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** States the consequence plainly, e.g. "The member cannot borrow until reactivated." */
  consequence: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use the danger button and warning glyph. */
  destructive?: boolean;
  /** Awaited before the dialog closes, so the UI can show a pending state. */
  onConfirm: () => void | Promise<void>;
};

/**
 * Confirmation for irreversible actions (ui-context.md §Component Conventions):
 * title, consequence text, danger button.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);

  // Never leave the dialog stuck if the caller's action throws.
  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={pending ? () => undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {destructive ? (
            <span className="mb-1 grid size-11 place-items-center rounded-full bg-danger-soft text-danger-ink">
              <TriangleAlert className="size-5" strokeWidth={1.75} />
            </span>
          ) : null}
          <AlertDialogTitle className="font-display text-h3 tracking-[-0.02em]">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-body leading-relaxed">
            {consequence}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            className={cn(buttonVariants({ variant: destructive ? "destructive" : "default" }))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
