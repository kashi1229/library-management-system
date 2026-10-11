import type { Metadata } from "next";
import { AuditScreen } from "@/components/features/audit/audit-screen";

export const metadata: Metadata = {
  title: "Audit Log",
  description: "An immutable record of every important action.",
};

/**
 * `/staff/audit` — the audit register.
 *
 * **The admin check stays in the page, not only in the route.** The staff layout guarantees a
 * *staff* session, which is not the same thing: a librarian reaching `/staff/audit` passes the
 * layout and would otherwise get the register. The API route refuses them with a 403, so they
 * would see an error where the data is — better to send them to their own home and say why, with
 * a page they were never entitled to (invariant 2, defence in depth).
 *
 * **`dynamic` is inherited from the staff layout.**
 */
export default function AuditLogPage() {
  return <AuditScreen />;
}