import type { Metadata } from "next";
import { MyWishlist } from "@/components/features/wishlist/my-wishlist";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Books you are keeping an eye on.",
};

/**
 * The member's reading list (spec 15, F10).
 *
 * A thin Server Component over a client page: the layout already resolves the session, and
 * the whole screen is client state (SWR plus the inline reserve and remove actions).
 *
 * **No `searchParams`.** Reading them would force `export const dynamic = "force-dynamic"`
 * for a page with no URL-driven filters — and a reading list has no filters to drive.
 */
export default function WishlistPage() {
  return <MyWishlist />;
}