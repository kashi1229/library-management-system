import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Members",
  description: "Search, review, suspend and activate library members.",
};

export default async function MembersPage() {
  return (
    <PlaceholderPage
      title="Members"
      description="Search, review, suspend and activate library members."
      icon={Users}
      unit={10}
    />
  );
}
