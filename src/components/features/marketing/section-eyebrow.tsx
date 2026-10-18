import { cn } from "@/lib/utils";

/**
 * The small uppercase label above a section heading.
 *
 * **One component for six sections.** The first version of the landing page wrote this line out
 * six times; two of them drifted to `text-muted-foreground` and the page lost the thread that
 * made the sections feel like one voice.
 */
export function SectionEyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-caption font-medium tracking-[0.14em] text-accent-ink uppercase", className)}>
      {children}
    </p>
  );
}