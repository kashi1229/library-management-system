import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Team",
  description: "Create and manage librarian and administrator accounts.",
};

export default async function TeamPage() {
  // Admin-only route: bounce librarians and members to their own home,
  // matching the middleware redirect (defence in depth).
  try {
    await requireAdmin();
  } catch {
    redirect(ROLE_HOME.member);
  }

  return (
    <PlaceholderPage
      title="Team"
      description="Create and manage librarian and administrator accounts."
      icon={ShieldCheck}
      unit={10}
    />
  );
}
