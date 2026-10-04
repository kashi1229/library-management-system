import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Categories",
  description: "Organise the catalog into browsable subjects.",
};

export default async function CategoriesPage() {
  return (
    <PlaceholderPage
      title="Categories"
      description="Organise the catalog into browsable subjects."
      icon={Tags}
      unit={7}
    />
  );
}
