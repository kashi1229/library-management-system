"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Banknote, Check, CreditCard, HandCoins, Loader2, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/common/form-alert";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCurrency } from "@/lib/utils";
import { finesApi, toErrorMessage, type FineListItem, type PublicPolicy } from "@/lib/api-client";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import type { z } from "zod";

/**
 * Collect or waive a fine (spec 13, F9).
 *
 * **Two actions, two dialogs, one component.** They share everything except the payload —
 * the fine summary, the amount, the terminal-state guard — so splitting them into two files
 * would duplicate the whole shell and let the copy drift.
 *
 * **Collect pre-fills the amount and shows it as read-only-ish.** The amount is the fine's
 * own total, and the service refuses anything less, so letting a librarian type a different
 * number invites a rejection they could have been spared. It is still a real field with a
 * real validator, because "what if it is wrong" is a legitimate question and the honest
 * answer is that the librarian should waive it instead.
 *
 * **Waive requires a reason**, not because the form demands one but because waiving
 * someone's debt is the one action here with no trace of who decided it. The reason is
 * stored on the document *and* written to the audit log.
 *
 * Rendered only while open and keyed by fine id, so the form mounts fresh and `isDirty`
 * is measured against the values that were actually loaded.
 */

// The form reuses the **server's** schemas rather than restating them. A second copy of
// "amount must be positive" or "reason must be 3-500 characters" is a second rule to keep
// in step with the first, and the browser is exactly the place where the two would drift
// apart silently: the server would reject a value the form had already called valid.
import {
  collectFineSchema,
  waiveFineSchema,
  type CollectFineInput,
  type WaiveFineInput,
} from "@/lib/validators/fine";

/**
 * `z.input`, not the exported `CollectFineInput`, because `amount` is `z.coerce`d: the
 * field arrives from the DOM as a **string** and only becomes a number once the schema has
 * parsed it. Typing the form as the output type would claim the input is already a number
 * and the resolver would not fit.
 */
type CollectValues = z.input<typeof collectFineSchema>;
type CollectOutput = CollectFineInput;

const METHOD_COPY: Record<PaymentMethod, { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  cash: { label: "Cash", icon: Banknote },
  card: { label: "Card", icon: CreditCard },
  other: { label: "Other", icon: HandCoins },
};

export function FineActionDialog({
  open,
  action,
  fine,
  policy,
  onClose,
  onChanged,
}: {
  open: boolean;
  action: "collect" | "waive" | null;
  fine: FineListItem | null;
  policy: PublicPolicy | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!open || !fine || !action) return null;

  return (
    <FineActionEditor
      key={`${fine.id}-${action}`}
      action={action}
      fine={fine}
      policy={policy}
      onDone={onClose}
      onChanged={onChanged}
    />
  );
}

function FineActionEditor({
  action,
  fine,
  policy,
  onDone,
  onChanged,
}: {
  action: "collect" | "waive";
  fine: FineListItem;
  policy: PublicPolicy | undefined;
  onDone: () => void;
  onChanged: () => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const isCollect = action === "collect";

  const collectForm = useForm<CollectValues, unknown, CollectOutput>({
    resolver: zodResolver(collectFineSchema),
    defaultValues: { paymentMethod: "cash", amount: fine.amount, note: "" },
  });

  const waiveForm = useForm<WaiveFineInput, unknown, WaiveFineInput>({
    resolver: zodResolver(waiveFineSchema),
    defaultValues: { reason: "" },
  });

  const [busy, setBusy] = React.useState(false);

  /*
   * `useWatch`, not `form.watch()`. React Hook Form's `watch()` returns a new function
   * every render and cannot be memoised safely, which React Compiler refuses to optimise
   * around — `react-hooks/incompatible-library`. `useWatch` subscribes properly and is the
   * pattern the rest of the codebase uses.
   */
  const paymentMethod = useWatch({ control: collectForm.control, name: "paymentMethod" });

  const submit = isCollect
    ? collectForm.handleSubmit(async (values) => {
        setBusy(true);
        setServerError(null);
        try {
          await finesApi.collect(fine.id, values);
          toast.success(`${formatCurrency(values.amount)} collected`, {
            description: `Recorded against “${fine.book.title}”.`,
          });
          onChanged();
          onDone();
        } catch (error) {
          const message = toErrorMessage(error, "We could not record that payment.");
          setServerError(message);
          toast.error("Could not collect the fine", { description: message });
        } finally {
          setBusy(false);
        }
      })
    : waiveForm.handleSubmit(async (values) => {
        setBusy(true);
        setServerError(null);
        try {
          await finesApi.waive(fine.id, values.reason);
          toast.success("Fine waived", {
            description: `${formatCurrency(fine.amount)} forgiven for “${fine.book.title}”.`,
          });
          onChanged();
          onDone();
        } catch (error) {
          const message = toErrorMessage(error, "We could not waive that fine.");
          setServerError(message);
          toast.error("Could not waive the fine", { description: message });
        } finally {
          setBusy(false);
        }
      });

  const formState = isCollect ? collectForm.formState : waiveForm.formState;

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onDone()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-6 pb-4 pr-14">
          <DialogTitle className="font-display text-h3 tracking-[-0.02em]">
            {isCollect ? "Collect a payment" : "Waive this fine"}
          </DialogTitle>
          <DialogDescription>
            {isCollect
              ? "Records the payment against the member's account. Fines cannot be collected twice."
              : "Forgives the debt entirely. The reason is stored on the record and in the audit log."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-5">
            <FormAlert message={serverError} />

            {/* The fine, restated. A payment is a financial act, so the person taking the
                money should not have to keep scrolling up to see what it is for. */}
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="line-clamp-2 text-small font-medium text-foreground">
                {fine.book.title}
              </p>
              <p className="mt-0.5 truncate text-caption text-muted-foreground">
                {fine.book.authors.join(", ") || fine.member.name}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-small">
                <div>
                  <dt className="text-caption text-muted-foreground">Amount</dt>
                  <dd className="font-display text-h3 font-semibold tabular-nums text-foreground">
                    {formatCurrency(fine.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={fine.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Days overdue</dt>
                  <dd className="text-foreground">
                    {fine.daysOverdue} {fine.daysOverdue === 1 ? "day" : "days"}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Rate charged</dt>
                  <dd className="text-foreground">{formatCurrency(fine.ratePerDay)}/day</dd>
                </div>
              </dl>

              {fine.raisedAt ? (
                <p className="mt-3 text-caption text-muted-foreground">
                  Raised {new Date(fine.raisedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              ) : null}
            </div>

            {isCollect ? (
              <>
                <Field label="Payment method" required>
                  <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                      const { label, icon: Icon } = METHOD_COPY[method];
                      const selected = paymentMethod === method;

                      return (
                        <button
                          key={method}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            collectForm.setValue("paymentMethod", method, { shouldDirty: true })
                          }
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-caption font-medium transition-colors",
                            "focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none",
                            selected
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border bg-surface text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field
                  label="Amount received"
                  required
                  error={collectForm.formState.errors.amount?.message}
                  helper={
                    policy
                      ? `Must cover the full ${formatCurrency(fine.amount)}. Part payments are not supported.`
                      : undefined
                  }
                >
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-small text-muted-foreground"
                    >
                      {policy?.currencySymbol ?? "$"}
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      className="pl-7 font-mono tabular-nums"
                      {...collectForm.register("amount")}
                    />
                  </div>
                </Field>

                <Field
                  label="Note"
                  error={collectForm.formState.errors.note?.message}
                  helper="Optional. Reference number, receipt, or anything worth recording."
                >
                  <Textarea rows={2} placeholder="Receipt 4471" {...collectForm.register("note")} />
                </Field>
              </>
            ) : (
              <>
                <Field
                  label="Reason for waiving"
                  required
                  error={waiveForm.formState.errors.reason?.message}
                  helper="Kept on the fine and in the audit log. The member sees the amount forgiven, not this."
                >
                  <Textarea
                    rows={3}
                    autoFocus
                    placeholder="Returned 3 days after we confirmed by phone that the copy was in transit."
                    {...waiveForm.register("reason")}
                  />
                </Field>

                <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-small text-warning-ink">
                  This forgives {formatCurrency(fine.amount)}. It cannot be undone — a waived
                  fine is terminal — but the member will be notified.
                </p>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-surface px-6 py-4 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onDone}
              disabled={busy}
              className="w-full sm:w-auto sm:me-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isCollect ? "default" : "destructive"}
              disabled={busy || !formState.isValid}
              className="w-full sm:w-auto"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {isCollect ? "Recording…" : "Waiving…"}
                </>
              ) : isCollect ? (
                <>
                  <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  Record payment
                </>
              ) : (
                <>
                  <ShieldOff className="size-4" aria-hidden="true" />
                  Waive fine
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}