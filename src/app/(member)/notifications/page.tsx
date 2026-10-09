import type { Metadata } from "next";
import { NotificationsManager } from "@/components/features/notifications/notifications-manager";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Loan updates, reservation holds, fines and account activity.",
};

/**
 * The inbox (spec 16).
 *
 * **No `requireSession()` here.** The `(member)` layout already resolves the session and
 * redirects anonymous visitors, and calling the guard again here would be a second database
 * read for the same answer. The list is fetched client-side through SWR because it changes on a
 * 60-second poll, and a server render would need refreshing to show anything new.
 */
export default function NotificationsPage() {
  return <NotificationsManager />;
}