import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/features/settings/settings-form";
import type { FullSettings } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Settings",
  description: "Library policy: loans, renewals, fines, reservations and currency.",
};

export default async function SettingsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect(ROLE_HOME.member);
  }

  const rawSettings = await getSettings();

  // Serialise for client
  const initialSettings: FullSettings = {
    _id: String(rawSettings._id),
    libraryName: rawSettings.libraryName,
    contactEmail: rawSettings.contactEmail ?? null,
    loanPeriodDays: rawSettings.loanPeriodDays,
    maxActiveLoans: rawSettings.maxActiveLoans,
    maxRenewals: rawSettings.maxRenewals,
    renewalExtensionDays: rawSettings.renewalExtensionDays,
    finePerDay: rawSettings.finePerDay,
    maxFinePerLoan: rawSettings.maxFinePerLoan,
    fineBlockThreshold: rawSettings.fineBlockThreshold,
    reservationHoldHours: rawSettings.reservationHoldHours,
    maxReservationsPerMember: rawSettings.maxReservationsPerMember,
    currencyCode: rawSettings.currencyCode,
    currencySymbol: rawSettings.currencySymbol,
    lastMaintenanceAt: rawSettings.lastMaintenanceAt ? rawSettings.lastMaintenanceAt.toISOString() : null,
    createdAt: rawSettings.createdAt ? rawSettings.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: rawSettings.updatedAt ? rawSettings.updatedAt.toISOString() : new Date().toISOString(),
  };

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Settings"
        description="Configure runtime policies for borrowing, fines, reservations, and library identity."
      />
      <SettingsForm initialSettings={initialSettings} />
    </div>
  );
}
