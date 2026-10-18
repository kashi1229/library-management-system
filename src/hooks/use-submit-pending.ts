"use client";

import * as React from "react";

/**
 * How long a pending state stays on screen at minimum.
 *
 * Below roughly 400ms a transition reads as a **flicker** rather than as work happening.
 * A sign-in against a local server resolves in ~80ms, so with no floor the spinner appears
 * and disappears inside a single frame: measured, the button still read "Sign in" and was
 * still enabled 3ms after the click, and had already reverted at the moment the response
 * arrived. A state that flickers is worse feedback than no state at all, because it reads as
 * a glitch in the page rather than as an answer from the server.
 */
export const MIN_PENDING_MS = 400;

export type SubmitPendingOptions = {
  /**
   * `handleSubmit` from react-hook-form. It is read at submit time through a ref, so the hook
   * does not have to be rebuilt whenever react-hook-form hands back a new closure.
   */
  handleSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  /**
   * Work that outlives the submit promise — a client-side route change, for instance.
   *
   * A successful sign-in resolves, and only then does the router start fetching the
   * destination. Without this the form's pending state has already ended by the time the
   * dashboard exists to render, so the login page sits there looking like nothing happened
   * for as long as the next route takes. Pass `useTransition`'s `isPending` here to cover
   * that window.
   */
  isSettling?: boolean;
  /** Override {@link MIN_PENDING_MS}. */
  minPendingMs?: number;
};

export type SubmitPending = {
  /**
   * True from the click until *both* the work has finished and the floor has elapsed.
   */
  isPending: boolean;
  /**
   * Hand this to `<form onSubmit>` instead of `handleSubmit`.
   *
   * It starts the pending state synchronously, **before** validation. `isSubmitting` cannot:
   * react-hook-form runs the zod resolver first, so there is a measurable window after the
   * click in which the button is still enabled and still says "Sign in" — 197ms in the
   * measurement that prompted this hook.
   */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

/**
 * A pending state that covers the *whole* submit, not just the request.
 *
 * Three things go wrong with a bare `formState.isSubmitting` on an auth form, and all three
 * are invisible to `tsc`, `eslint` and `next build`:
 *
 * 1. **A dead gap.** Validation runs before the callback, so the first ~200ms show no
 *    feedback at all.
 * 2. **A flicker.** A fast response ends the state inside one frame.
 * 3. **A second dead gap.** The promise resolves before the router has fetched the
 *    destination, so the button reverts to its idle label and accepts another click while
 *    the dashboard is still loading.
 *
 * This hook closes all three: the state starts on the click, lasts at least
 * {@link MIN_PENDING_MS}, and stays up while `isSettling` is true. It also ignores a second
 * submit while the first is live, so a double-click cannot fire two requests — which on a
 * register form would be a second insert, not a second login.
 */
export function useSubmitPending({
  handleSubmit,
  isSettling = false,
  minPendingMs = MIN_PENDING_MS,
}: SubmitPendingOptions): SubmitPending {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const submitRef = React.useRef(handleSubmit);
  React.useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Refs, not state, for the two things the timers read and the guard needs. Setting them
  // from `setState` would mean a render before a timeout callback could see them.
  const lockedRef = React.useRef(false);
  const workDoneRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = React.useCallback(() => {
    workDoneRef.current = true;
    // The floor has already elapsed, so nothing is left to wait for.
    if (timerRef.current === null) setIsSubmitting(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (lockedRef.current) return;

      lockedRef.current = true;
      workDoneRef.current = false;
      setIsSubmitting(true);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Whichever of the two happens last performs the single reset, so the state
        // lasts exactly `max(work, floor)` and is cleared exactly once.
        if (workDoneRef.current) {
          lockedRef.current = false;
          setIsSubmitting(false);
        }
      }, minPendingMs);

      // An IIFE rather than `.finally()` on the returned promise: `handleSubmit` throws
      // synchronously if the resolver does, and that would leave the form locked forever.
      void (async () => {
        try {
          await submitRef.current(event);
        } finally {
          release();
        }
      })();
    },
    [minPendingMs, release],
  );

  return { isPending: isSubmitting || isSettling, onSubmit };
}
