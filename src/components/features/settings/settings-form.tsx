"use client";

import * as React from "react";
import useSWR from "swr";
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
import { settingsApi, toErrorMessage, type FullSettings } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";

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

export function SettingsForm({ initialSettings }: { initialSettings?: FullSettings }) {
  const { data: settings, error, isLoading, mutate } = useSWR(
    "/api/settings",
    () => settingsApi.get(),
    { fallbackData: initialSettings },
  );

  const [formData, setFormData] = React.useState<SettingsFormData | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isMaintaining, setIsMaintaining] = React.useState(false);

  // Sync form state when remote settings arrive
  React.useEffect(() => {
    if (settings) {
      setFormData({
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
      });
    }
  }, [settings]);

  // Compute dirty state
  const isDirty = React.useMemo(() => {
    if (!settings || !formData) return false;
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
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
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
      });
      setErrors({});
      toast.info("Changes reset to saved values.");
    }
  };

  const validate = (): boolean => {
    if (!formData) return false;
    const errs: Record<string, string> = {};

    if (!formData.libraryName.trim()) {
      errs.libraryName = "Library name is required.";
    }

    if (formData.loanPeriodDays < 1 || formData.loanPeriodDays > 90) {
      errs.loanPeriodDays = "Loan period must be between 1 and 90 days.";
    }

    if (formData.maxActiveLoans < 1 || formData.maxActiveLoans > 20) {
      errs.maxActiveLoans = "Max active loans must be between 1 and 20.";
    }

    if (formData.maxRenewals < 0 || formData.maxRenewals > 10) {
      errs.maxRenewals = "Max renewals must be between 0 and 10.";
    }

    if (formData.renewalExtensionDays < 1 || formData.renewalExtensionDays > 30) {
      errs.renewalExtensionDays = "Renewal extension must be between 1 and 30 days.";
    }

    if (formData.finePerDay < 0 || formData.finePerDay > 1000) {
      errs.finePerDay = "Fine per day must be between 0 and 1,000.";
    }

    if (formData.maxFinePerLoan < formData.finePerDay) {
      errs.maxFinePerLoan = "Max fine per loan must be at least equal to daily fine rate.";
    }

    if (formData.fineBlockThreshold < 0) {
      errs.fineBlockThreshold = "Fine block threshold cannot be negative.";
    }

    if (formData.reservationHoldHours < 1 || formData.reservationHoldHours > 240) {
      errs.reservationHoldHours = "Hold window must be between 1 and 240 hours.";
    }

    if (formData.maxReservationsPerMember < 1 || formData.maxReservationsPerMember > 10) {
      errs.maxReservationsPerMember = "Max reservations must be between 1 and 10.";
    }

    if (!/^[A-Z]{3}$/.test(formData.currencyCode)) {
      errs.currencyCode = "Currency code must be a 3-letter code (e.g. USD).";
    }

    if (!formData.currencySymbol.trim() || formData.currencySymbol.length > 4) {
      errs.currencySymbol = "Currency symbol must be 1 to 4 characters.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !formData) return;

    setIsSaving(true);
    try {
      const updated = await settingsApi.update({
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
      });

      await mutate(updated, false);
      toast.success("Settings saved successfully.", {
        description: "Library policies and rules updated immediately.",
      });
    } catch (err) {
      toast.error("Failed to save settings.", {
        description: toErrorMessage(err),
      });
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
      await mutate();
    } catch (err) {
      toast.error("Failed to run maintenance", {
        description: toErrorMessage(err),
      });
    } finally {
      setIsMaintaining(false);
    }
  };

  if (isLoading && !formData) {
    return (
      <div className="flex flex-col items-center justify-center py-24" aria-busy="true">
        <Spinner label="Loading settings" />
      </div>
    );
  }

  if (error && !formData) {
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

  if (!formData) return null;

  return (
    <form onSubmit={handleSave} className="space-y-8 pb-32">
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
