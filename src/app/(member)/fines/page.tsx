import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Fines",
  description: "Outstanding balances and a full payment history.",
};

export default async function FinesPage() {
  return (
    <PlaceholderPage
      title="Fines"
      description="Outstanding balances and a full payment history."
      icon={Receipt}
      unit={13}
    />
  );
}
