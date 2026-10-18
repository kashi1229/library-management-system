"use client";

import * as React from "react";
import useSWR from "swr";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  BookOpen,
  Receipt,
  Clock,
  Wrench,
  Save,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/common/spinner";
import { EmptyState } from "@/components/common/empty-state";
import {
  ApiRequestError,
  settingsApi,
  toErrorMessage,
  type FullSettings,
} from "@/lib/api-client";
import { updateSettingsSchema, type UpdateSettingsInput } from "@/lib/validators/settings";
import { formatDate } from "@/lib/utils";

type SettingsFormData = {
  libraryName: string;
  contactEmail: string;
  loanPeriodDays: number;
  maxActiveLoans: number;
  maxRenewals: number;
  renewalExtensionDays: number;
  finePerDay: number;
  maxFinePerLoan: number;
  fineBlockThreshold: number;
  reservationHoldHours: number;
  maxReservationsPerMember: number;
  currencyCode: string;
  currencySymbol: string;
};

/**
 * The exact body the API receives.
 *
 * Built in one place because it used to be written twice — once inside `validate()`
 * and once inside `handleSave()` — and the two could disagree about what was being
 * checked against what was being sent. `Number(...)` matters here: the inputs are
 * `type="number"`, but `parseInt("")` is `NaN`, and the schema needs a real number
 * or a `0` the admin can see and correct.
 */
function toPayload(formData: SettingsFormData): UpdateSettingsInput {
  return {
    libraryName: formData.libraryName,
    contactEmail: formData.contactEmail.trim() || null,
    loanPeriodDays: Number(formData.loanPeriodDays),
    maxActiveLoans: Number(formData.maxActiveLoans),
    maxRenewals: Number(formData.maxRenewals),
    renewalExtensionDays: Number(formData.renewalExtensionDays),
    finePerDay: Number(formData.finePerDay),
    maxFinePerLoan: Number(formData.maxFinePerLoan),
    fineBlockThreshold: Number(formData.fineBlockThreshold),
    reservationHoldHours: Number(formData.reservationHoldHours),
    maxReservationsPerMember: Number(formData.maxReservationsPerMember),
    currencyCode: formData.currencyCode,
    currencySymbol: formData.currencySymbol,
  };
}

/**
 * Client-side validation by **running the server's own schema**.
 *
 * This form used to hand-roll twelve range checks beside the schema in
 * `validators/settings.ts`, and two rules never made the copy: `contactEmail` had
 * none at all, and `libraryName`'s 80-character ceiling was missing. An admin who
 * typed `athenaeum.edu` therefore got a 422 with the generic "Please check the
 * highlighted fields." and **no field highlighted** — because `handleSave` threw the
 * server's field errors away instead of mapping them onto the inputs, which every
 * other form in this app already does.
 *
 * One schema, run in both places, is what makes that class of drift impossible.
 */
function validatePayload(payload: UpdateSettingsInput): Record<string, string> {
  const result = updateSettingsSchema.safeParse(payload);
  if (result.success) return {};

  const { fieldErrors } = z.flattenError(result.error);
  const errors: Record<string, string> = {};
  // First message per field: the schema stacks `.min` and `.regex` messages on the
  // same key, and one sentence per input is all a `Field` can show.
  for (const [name, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) errors[name] = messages[0];
  }
  return errors;
}

/**
 * Seed the editable form from the saved record.
 *
 * **One mapping, not three.** The version this replaced built the same object in an effect, in
 * "Revert", and once more inline — and the three copies were free to drift, which is how the
 * Unit 08 payload mismatch happened in the first place.
 */
function toFormData(settings: FullSettings): SettingsFormData {
  return {
    libraryName: settings.libraryName ?? "",
    contactEmail: settings.contactEmail ?? "",
    loanPeriodDays: settings.loanPeriodDays ?? 14,
    maxActiveLoans: settings.maxActiveLoans ?? 5,
    maxRenewals: settings.maxRenewals ?? 2,
    renewalExtensionDays: settings.renewalExtensionDays ?? 7,
    finePerDay: settings.finePerDay ?? 5,
    maxFinePerLoan: settings.maxFinePerLoan ?? 250,
    fineBlockThreshold: settings.fineBlockThreshold ?? 100,
    reservationHoldHours: settings.reservationHoldHours ?? 48,
    maxReservationsPerMember: settings.maxReservationsPerMember ?? 3,
    currencyCode: settings.currencyCode ?? "USD",
    currencySymbol: settings.currencySymbol ?? "$",
  };
}

/**
 * Fetches the settings and owns the loading / error / empty states.
 *
 * **It renders no form itself.** The editor below is given a `key` derived from the saved values,
 * so a save re-seeds the fields by remounting them — which is the "keyed so values come from
 * props with no reset effect" pattern `CategoryDialog` already uses. The version this replaced
 * wrote the fields back from a `useEffect`, which React 19's `set-state-in-effect` rule rejects
 * and which is also a genuine defect: the effect runs after paint, so the form briefly shows
 * empty inputs before the first response lands.
 */
export function SettingsForm({ initialSettings }: { initialSettings?: FullSettings }) {
  const { data: settings, error, isLoading, mutate } = useSWR(
    "/api/settings",
    () => settingsApi.get(),
    { fallbackData: initialSettings },
  );

  if (isLoading && !settings) {
    return (
      <div className="flex flex-col items-center justify-center py-24" aria-busy="true">
        <Spinner label="Loading settings" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <Card className="rounded-xl border border-danger/30 p-4">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load settings"
          description={toErrorMessage(error)}
          action={<Button onClick={() => mutate()}>Retry</Button>}
        />
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <SettingsEditor
      /*
       * Derived from the *saved values*, not from `updatedAt`. Running maintenance also bumps
       * `updatedAt`, and keying on that would silently discard an admin's unsaved edits because
       * they pressed the wrong button. Thirteen short fields stringify to well under a
       * millisecond, and this changes exactly when — and only when — the form must re-seed.
       */
      key={JSON.stringify(toFormData(settings))}
      settings={settings}
      onMutate={mutate}
    />
  );
}

function SettingsEditor({
  settings,
  onMutate,
}: {
  settings: FullSettings;
  onMutate: (data?: FullSettings, opts?: { revalidate?: boolean }) => Promise<unknown>;
}) {
  const [formData, setFormData] = React.useState<SettingsFormData>(() => toFormData(settings));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isMaintaining, setIsMaintaining] = React.useState(false);

  // Compute dirty state
  const isDirty = React.useMemo(() => {
    return (
      formData.libraryName !== settings.libraryName ||
      formData.contactEmail !== (settings.contactEmail ?? "") ||
      formData.loanPeriodDays !== settings.loanPeriodDays ||
      formData.maxActiveLoans !== settings.maxActiveLoans ||
      formData.maxRenewals !== settings.maxRenewals ||
      formData.renewalExtensionDays !== settings.renewalExtensionDays ||
      formData.finePerDay !== settings.finePerDay ||
      formData.maxFinePerLoan !== settings.maxFinePerLoan ||
      formData.fineBlockThreshold !== settings.fineBlockThreshold ||
      formData.reservationHoldHours !== settings.reservationHoldHours ||
      formData.maxReservationsPerMember !== settings.maxReservationsPerMember ||
      formData.currencyCode !== settings.currencyCode ||
      formData.currencySymbol !== settings.currencySymbol
    );
  }, [settings, formData]);

  const handleChange = (key: keyof SettingsFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleReset = () => {
    setFormData(toFormData(settings));
    setErrors({});
    toast.info("Changes reset to saved values.");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = toPayload(formData);
    const invalid = validatePayload(payload);
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      return;
    }

    setIsSaving(true);
    setErrors({});
    try {
      const updated = await settingsApi.update(payload);

      await onMutate(updated, { revalidate: false });
      toast.success("Settings saved successfully.", {
        description: "Library policies and rules updated immediately.",
      });
    } catch (err) {
      // The server is the authority on these rules, so its per-field messages win
      // and land on the inputs rather than in a toast nobody can act on.
      if (err instanceof ApiRequestError && err.fields && Object.keys(err.fields).length > 0) {
        setErrors(err.fields);
        toast.error("Please check the highlighted fields.");
      } else {
        toast.error("Failed to save settings.", { description: toErrorMessage(err) });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunMaintenance = async () => {
    setIsMaintaining(true);
    try {
      const res = await settingsApi.runMaintenance();
      const counts = res.counts;
      if (counts.skipped) {
        toast.info("Maintenance skipped", {
          description: "Another maintenance run was completed recently within throttle window.",
        });
      } else {
        toast.success("Maintenance routine completed", {
          description: `Processed: ${counts.expiredReservations} expired holds, ${counts.dueSoon} due notices, ${counts.overdue} overdue notices.`,
        });
      }
      await onMutate();
    } catch (err) {
      toast.error("Failed to run maintenance", {
        description: toErrorMessage(err),
      });
    } finally {
      setIsMaintaining(false);
    }
  };

  /*
   * `noValidate`, like every other form in the app. Without it the browser's own
   * constraint bubbles (`type="email"`, `min`/`max`, `maxLength`) intercept the
   * submit event first, so `handleSave` never runs: the admin gets a transient
   * native tooltip instead of this app's inline, screen-reader-announced message,
   * and a genuine validation failure can look like the button simply did nothing.
   */
  return (
    <form onSubmit={handleSave} noValidate className="space-y-8 pb-32">
      {/* 1. Identity & Contact */}
      <Card className="rounded-xl border border-border/80 bg-surface shadow-xs">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
              <Building2 className="size-4.5" strokeWidth={1.85} />
            </span>
            <div>
              <CardTitle className="font-display text-h3 font-semibold text-foreground">
                Library Identity
              </CardTitle>
              <CardDescription className="text-caption text-muted-foreground">
                The name displayed in the topbar, landing page, and system communications.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
          <Field label="Library Name" required error={errors.libraryName}>
            <Input
              value={formData.libraryName}
              onChange={(e) => handleChange("libraryName", e.target.value)}
              placeholder="e.g. Athenaeum Public Library"
            />
          </Field>
          <Field
            label="Contact Email"
            helper="Optional public support or inquiries address."
            error={errors.contactEmail}
          >
            <Input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => handleChange("contactEmail", e.target.value)}
              placeholder="librarian@athenaeum.edu"
            />
          </Field>
        </CardContent>
      </Card>

      {/* 2. Circulation & Loans Policy */}
      <Card className="rounded-xl border border-border/80 bg-surface shadow-xs">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-info-soft text-info-ink">
              <BookOpen className="size-4.5" strokeWidth={1.85} />
            </span>
            <div>
              <CardTitle className="font-display text-h3 font-semibold text-foreground">
                Circulation & Loans
              </CardTitle>
              <CardDescription className="text-caption text-muted-foreground">
                Rules governing loan durations, limits, and renewal allowances.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Loan Period"
            helper="Days before a loan is due."
            error={errors.loanPeriodDays}
          >
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={90}
                value={formData.loanPeriodDays}
                onChange={(e) => handleChange("loanPeriodDays", parseInt(e.target.value) || 0)}
                className="pr-14 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                days
              </span>
            </div>
          </Field>

          <Field
            label="Max Active Loans"
            helper="Simultaneous books per member."
            error={errors.maxActiveLoans}
          >
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={20}
                value={formData.maxActiveLoans}
                onChange={(e) => handleChange("maxActiveLoans", parseInt(e.target.value) || 0)}
                className="pr-14 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                books
              </span>
            </div>
          </Field>

          <Field
            label="Max Renewals"
            helper="Times a loan can be renewed."
            error={errors.maxRenewals}
          >
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={10}
                value={formData.maxRenewals}
                onChange={(e) => handleChange("maxRenewals", parseInt(e.target.value) || 0)}
                className="pr-14 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                times
              </span>
            </div>
          </Field>

          <Field
            label="Renewal Extension"
            helper="Days added per renewal."
            error={errors.renewalExtensionDays}
          >
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={30}
                value={formData.renewalExtensionDays}
                onChange={(e) => handleChange("renewalExtensionDays", parseInt(e.target.value) || 0)}
                className="pr-14 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                days
              </span>
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* 3. Fines & Currency */}
      <Card className="rounded-xl border border-border/80 bg-surface shadow-xs">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-warning-soft text-warning-ink">
              <Receipt className="size-4.5" strokeWidth={1.85} />
            </span>
            <div>
              <CardTitle className="font-display text-h3 font-semibold text-foreground">
                Fines & Currency
              </CardTitle>
              <CardDescription className="text-caption text-muted-foreground">
                Overdue penalties, borrowing lockout thresholds, and monetary formatting.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Fine Per Day"
              helper="Overdue fee accrued daily."
              error={errors.finePerDay}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                  {formData.currencySymbol}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  value={formData.finePerDay}
                  onChange={(e) => handleChange("finePerDay", parseFloat(e.target.value) || 0)}
                  className="pl-7 pr-16 tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                  / day
                </span>
              </div>
            </Field>

            <Field
              label="Max Fine Per Loan"
              helper="Upper cap on a single book."
              error={errors.maxFinePerLoan}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                  {formData.currencySymbol}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  value={formData.maxFinePerLoan}
                  onChange={(e) => handleChange("maxFinePerLoan", parseFloat(e.target.value) || 0)}
                  className="pl-7 pr-14 tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                  cap
                </span>
              </div>
            </Field>

            <Field
              label="Fine Block Threshold"
              helper="Balance blocking new checkouts."
              error={errors.fineBlockThreshold}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                  {formData.currencySymbol}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  value={formData.fineBlockThreshold}
                  onChange={(e) => handleChange("fineBlockThreshold", parseFloat(e.target.value) || 0)}
                  className="pl-7 pr-16 tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                  limit
                </span>
              </div>
            </Field>
          </div>

          <div className="border-t border-border/60 pt-5">
            <h4 className="mb-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Currency Format
            </h4>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Currency Code"
                helper="ISO 4217 3-letter currency code."
                error={errors.currencyCode}
              >
                <Input
                  value={formData.currencyCode}
                  maxLength={3}
                  onChange={(e) => handleChange("currencyCode", e.target.value.toUpperCase())}
                  placeholder="USD"
                  className="uppercase tabular-nums"
                />
              </Field>

              <Field
                label="Currency Symbol"
                helper="Display symbol prefix."
                error={errors.currencySymbol}
              >
                <Input
                  value={formData.currencySymbol}
                  maxLength={4}
                  onChange={(e) => handleChange("currencySymbol", e.target.value)}
                  placeholder="$"
                />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Reservations Policy */}
      <Card className="rounded-xl border border-border/80 bg-surface shadow-xs">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-ink">
              <Clock className="size-4.5" strokeWidth={1.85} />
            </span>
            <div>
              <CardTitle className="font-display text-h3 font-semibold text-foreground">
                Reservations & Holds
              </CardTitle>
              <CardDescription className="text-caption text-muted-foreground">
                Timeframe for member pickup once a reserved title is shelved.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
          <Field
            label="Hold Shelf Duration"
            helper="Hours before a hold expires and next queue member is notified."
            error={errors.reservationHoldHours}
          >
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={240}
                value={formData.reservationHoldHours}
                onChange={(e) => handleChange("reservationHoldHours", parseInt(e.target.value) || 0)}
                className="pr-16 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                hours
              </span>
            </div>
          </Field>

          <Field
            label="Max Active Reservations"
            helper="Max simultaneous queue places per member."
            error={errors.maxReservationsPerMember}
          >
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={10}
                value={formData.maxReservationsPerMember}
                onChange={(e) => handleChange("maxReservationsPerMember", parseInt(e.target.value) || 0)}
                className="pr-16 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                holds
              </span>
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* 5. System Maintenance */}
      <Card className="rounded-xl border border-border/80 bg-surface shadow-xs">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Wrench className="size-4.5" strokeWidth={1.85} />
              </span>
              <div>
                <CardTitle className="font-display text-h3 font-semibold text-foreground">
                  Automated Maintenance
                </CardTitle>
                <CardDescription className="text-caption text-muted-foreground">
                  Periodic sweep expiring old holds, marking overdue loans, and emitting alerts.
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMaintaining}
              onClick={handleRunMaintenance}
              className="gap-1.5 shadow-2xs"
            >
              {isMaintaining ? (
                <Spinner label="Running maintenance…" className="size-3.5" />
              ) : (
                <Play className="size-3.5" strokeWidth={1.85} />
              )}
              <span>Run sweep now</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-small font-medium text-foreground">Last automated sweep</p>
              <p className="text-caption text-muted-foreground">
                {settings?.lastMaintenanceAt
                  ? formatDate(settings.lastMaintenanceAt, "d MMM yyyy, HH:mm")
                  : "No record of a prior maintenance sweep."}
              </p>
            </div>
            {settings?.lastMaintenanceAt && (
              <span className="inline-flex items-center gap-1.5 text-caption font-medium text-success-ink">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                Operational
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sticky Bottom Action Bar when Form is Dirty */}
      {isDirty && (
        <aside
          role="region"
          aria-label="Pending changes"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-surface/95 px-4 py-3.5 shadow-lift backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              <p className="text-small font-medium text-foreground">
                You have unsaved changes to library policies.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSaving}
                onClick={handleReset}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                <span>Revert</span>
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="gap-1.5 shadow-xs"
              >
                {isSaving ? (
                  <Spinner label="Saving…" className="size-3.5" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>Save changes</span>
              </Button>
            </div>
          </div>
        </aside>
      )}
    </form>
  );
}
