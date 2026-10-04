import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

/**
 * Placeholder for a route whose real screen lands in a later unit.
 *
 * It keeps the shell honest during development: the page has its final header
 * and a real empty state, so navigation, titles and responsive layout can be
 * verified before the data arrives. Unit 21 removes the ones still standing.
 */
export function PlaceholderPage({
  title,
  description,
  icon,
  unit,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Which unit delivers the real screen. */
  unit: number;
}) {
  return (
    <div className="container-page space-y-8">
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          icon={icon}
          title={`${title} arrives in Unit ${String(unit).padStart(2, "0")}`}
          description="The navigation, layout and states around this screen are already wired. Real data arrives with the unit listed above."
        />
      </div>
    </div>
  );
}
