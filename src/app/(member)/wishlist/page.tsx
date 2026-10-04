import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Books you have saved for later.",
};

export default async function WishlistPage() {
  return (
    <PlaceholderPage
      title="Wishlist"
      description="Books you have saved for later."
      icon={Heart}
      unit={15}
    />
  );
}
