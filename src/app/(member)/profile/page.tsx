import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your details, avatar, password and account information.",
};

export default async function ProfilePage() {
  return (
    <PlaceholderPage
      title="Profile"
      description="Your details, avatar, password and account information."
      icon={UserRound}
      unit={6}
    />
  );
}
