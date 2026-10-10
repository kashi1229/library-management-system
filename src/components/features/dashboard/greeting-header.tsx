"use client";

import * as React from "react";

/**
 * "Good evening, Sara" plus today's date.
 *
 * **A Client Component because it reads the browser's clock.** It is otherwise pure markup, and
 * the missing `"use client"` looked entirely harmless — `tsc` passed, `next build` passed, and
 * the member dashboard rendered an error boundary saying "Something went wrong". The failure is
 * `TypeError: useSyncExternalStore only works in Client Components`, which only exists at render
 * time. This is the second time in this file's history that "harmless component" reasoning has
 * cost a whole page; the first was `icon={BookOpen}` on a `StatCard`.
 *
 * **The greeting is chosen by the reader's clock, not the server's.** It is rendered from the
 * server component tree, so `new Date()` would be the *server's* time — and a librarian in
 * Auckland opening the library at 9am would be greeted by an afternoon header built on a UTC box.
 * So the slot is computed in the browser, where the clock is the reader's, and the server renders
 * a neutral "Welcome back" that is never wrong.
 *
 * **Rendering the fallback rather than nothing** is what keeps the layout stable: the name and
 * the date occupy the same lines either way, so swapping in the real greeting on the next frame
 * moves no pixels. `useSyncExternalStore` is the codebase's established hydration-safe pattern
 * (`useIsHydrated`), not the `useEffect(() => setMounted(true))` this project forbids.
 */
export function GreetingHeader({ name }: { name: string }) {
  const firstName = name.trim().split(/\s+/)[0] ?? name;
  const today = useToday();

  return (
    <header className="space-y-1">
      <h1 className="text-h1 font-display font-semibold tracking-[-0.02em] text-pretty text-foreground md:text-h1">
        {today ? `${greeting(today.getHours())}, ${firstName}` : `Welcome back, ${firstName}`}
      </h1>
      <p className="text-body text-muted-foreground">
        {/* The date is below the greeting rather than beside it: at 360px there is no room for
            both on one line, and a wrapped two-column header reads as two unrelated facts. */}
        {today
          ? today.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          : "Here is where things stand with your library account."}
      </p>
    </header>
  );
}

/**
 * Four buckets, matching how the day is actually described.
 *
 * **`morning` ends at 12 and `afternoon` ends at 18** rather than at 12/18 exactly — "good
 * afternoon" at 08:00 is the kind of small wrongness nobody reports and everybody notices.
 */
function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The reader's `Date`, or `null` until the client has taken over.
 *
 * **`new Date()` in `getSnapshot` is a violation of the `useSyncExternalStore` contract** — it
 * returns a new value on every call, so React reports a change on every render and spins. The
 * date is therefore cached per calendar day and only rebuilt when the day actually rolls over,
 * which is also the only time the header needs to change.
 */
let cache: { day: number; value: Date | null } | null = null;

function getToday(): Date | null {
  const now = new Date();
  const day = Math.floor(now.getTime() / 86_400_000);

  if (cache && cache.day === day) return cache.value;

  const value = now;
  cache = { day, value };
  return value;
}

const getServerToday = (): null => null;

function subscribe(onStoreChange: () => void): () => void {
  // A dashboard is not open across midnight in practice, but the check is one line and it means
  // a tab left open overnight greets the reader correctly when they come back to it.
  const timer = setInterval(onStoreChange, 60_000);
  return () => clearInterval(timer);
}

function useToday(): Date | null {
  return React.useSyncExternalStore(subscribe, getToday, getServerToday);
}