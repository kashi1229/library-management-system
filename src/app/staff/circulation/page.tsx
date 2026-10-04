import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Circulation",
  description: "Issue, return and renew books at the desk.",
};

export default async function CirculationPage() {
  return (
    <PlaceholderPage
      title="Circulation"
      description="Issue, return and renew books at the desk."
      icon={ArrowLeftRight}
      unit={12}
    />
  );
}
