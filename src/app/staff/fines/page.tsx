import type { Metadata } from "next";
import { FinesRegister } from "@/components/features/fines/fines-register";

export const metadata: Metadata = {
  title: "Fines",
  description: "Collect and waive fines across all members.",
};

/**
 * The staff fine register (spec 13).
 *
 * The layout already enforces `requireStaff()`, and the register is entirely client state
 * (tab, debounced search, the KPI strip, the action dialogs), so this stays a thin Server
 * Component rather than reading anything on the server first.
 */
export default function StaffFinesPage() {
  return <FinesRegister />;
}