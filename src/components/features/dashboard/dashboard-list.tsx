import * as React from "react";
import { PackageOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The card chrome every short dashboard list shares, plus its empty state.
 *
 * **Extracted because four lists on the staff dashboard are the same shape** — a heading, a
 * sentence saying what the list is for, and either rows or a dashed panel saying there are none.
 * Four hand-written copies drifted within the hour: two used `py-16` and two used `py-10`, so the
 * page had two different heights of "nothing here".
 *
 * **The empty panel says what would be in it.** A dashed box reading "No low stock" leaves the
 * reader wondering whether the query ran; one sentence saying *nothing has dropped to one copy or
 * fewer* answers it.
 */
export function DashboardList({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  description?: string;
  /** Drives whether the header shows a count or nothing. */
  items: number;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-h3 font-semibold tracking-[-0.02em]">{title}</CardTitle>
        {description ? <p className="text-small text-muted-foreground text-pretty">{description}</p> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {items > 0 ? <div className="divide-y divide-border">{children}</div> : <ListEmpty title={emptyTitle} description={emptyDescription} />}
      </CardContent>
    </Card>
  );
}

/** The dashed "there is nothing here" panel. Decorative glyph; the words carry the meaning. */
export function ListEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"
      >
        <PackageOpen className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-small font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-caption text-muted-foreground text-pretty">{description}</p>
    </div>
  );
}