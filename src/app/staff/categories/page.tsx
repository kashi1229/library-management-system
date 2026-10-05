import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { CategoriesManager } from "@/components/features/categories/categories-manager";

export const metadata: Metadata = {
  title: "Categories",
  description: "Create and manage the catalog shelves that group related books.",
};

/** Staff page. The layout already enforces the role; this is belt and braces. */
export default async function CategoriesPage() {
  await requireStaff();
  return <CategoriesManager />;
}
