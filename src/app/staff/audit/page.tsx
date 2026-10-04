import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Audit Log",
  description: "An immutable record of every important action.",
};

export default async function AuditLogPage() {
  // Admin-only route: bounce librarians and members to their own home,
  // matching the middleware redirect (defence in depth).
  try {
    await requireAdmin();
  } catch {
    redirect(ROLE_HOME.member);
  }

  return (
    <PlaceholderPage
      title="Audit Log"
      description="An immutable record of every important action."
      icon={ScrollText}
      unit={18}
    />
  );
}
