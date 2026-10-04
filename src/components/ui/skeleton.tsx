import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Skeletons match the final layout (ui-context.md) and use
 * a soft shimmer over the muted surface.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
