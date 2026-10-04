import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Settings",
  description: "Library policy: loans, renewals, fines, reservations and currency.",
};

export default async function SettingsPage() {
  // Admin-only route: bounce librarians and members to their own home,
  // matching the middleware redirect (defence in depth).
  try {
    await requireAdmin();
  } catch {
    redirect(ROLE_HOME.member);
  }

  return (
    <PlaceholderPage
      title="Settings"
      description="Library policy: loans, renewals, fines, reservations and currency."
      icon={Settings}
      unit={19}
    />
  );
}
