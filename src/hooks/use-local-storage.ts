"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage-backed state without the `setState`-in-effect cascade.
 *
 * `useSyncExternalStore` is the right primitive here: the server snapshot is
 * `fallback`, so the first client render always matches the server markup (no
 * hydration mismatch), and writes go straight to localStorage and notify
 * subscribers instead of triggering an extra render pass.
 *
 * `window.localStorage` can throw (Safari private mode, disabled cookies), so
 * every access is guarded and falls back to the in-memory value.
 */

function subscribe(onStoreChange: () => void): () => void {
  // `storage` only fires in *other* tabs, so the writer dispatches it manually.
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function useLocalStorage<T extends string | boolean>(
  key: string,
  fallback: T,
): [T, (value: T) => void] {
  const read = useCallback((): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      if (typeof fallback === "boolean") return (raw === "true") as T;
      return raw as unknown as T;
    } catch {
      return fallback;
    }
  }, [key, fallback]);

  // Server snapshot is always the fallback: a stored preference must never
  // change the first paint, only later renders.
  const value = useSyncExternalStore(
    subscribe,
    read,
    () => fallback,
  ) as T;

  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        /* storage unavailable — the value simply will not persist */
      }
      window.dispatchEvent(new Event("storage"));
    },
    [key],
  );

  return [value, setValue];
}
