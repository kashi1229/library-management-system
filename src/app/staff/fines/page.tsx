import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Fines",
  description: "Collect and waive fines across all members.",
};

export default async function FinesPage() {
  return (
    <PlaceholderPage
      title="Fines"
      description="Collect and waive fines across all members."
      icon={Receipt}
      unit={13}
    />
  );
}
