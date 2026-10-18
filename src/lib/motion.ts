import type { Transition, Variants } from "motion/react";

/**
 * Shared motion language — the single source of truth for every animation in the app.
 * Values mirror context/ui-context.md ("Motion Language"). Components must import
 * these variants/transitions instead of writing inline durations or easings.
 *
 * Only *type* imports come from `motion/react` here, so this module stays safe to
 * import from Server Components. Reduced-motion awareness lives in the
 * `fadeUpReduced`/`staggerReduced`/… variants and the `useMotionVariants()` hook.
 */

/** Easing, durations, distances and stagger steps from ui-context.md. */
export const motionTokens = {
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp: [0.4, 0, 0.2, 1],
    linear: [0, 0, 1, 1],
  },
  duration: {
    fast: 0.15, // hover / micro-interactions
    base: 0.25, // UI (dialogs, sheets, chips)
    slow: 0.45, // page + hero entrances
    /**
     * One full there-and-back of the landing page's floating covers.
     *
     * **Far slower than any UI transition on purpose.** A cover that drifts at 0.45s reads as
     * attention-seeking; at 7.5s it reads as a page that is breathing. `repeatType: "mirror"`
     * rather than `y: [a, b, a]` so the motion is a true sine with no jump at the seam.
     */
    drift: 7.5,
  },
  distance: {
    xs: 4,
    sm: 8, // page transition rise
    md: 16,
    lg: 24,
  },
  scale: {
    press: 0.98, // button press
    enter: 0.97, // dialog / popover scale-in
    pop: 1.04, // wishlist heart
  },
  stagger: {
    list: 0.04, // 40ms between list children
    section: 0.06,
  },
} as const;

/** Named transitions, so no component ever hardcodes a duration. */
export const transitions = {
  fast: {
    duration: motionTokens.duration.fast,
    ease: motionTokens.easing.smooth,
  },
  base: {
    duration: motionTokens.duration.base,
    ease: motionTokens.easing.smooth,
  },
  slow: {
    duration: motionTokens.duration.slow,
    ease: motionTokens.easing.smooth,
  },
} as const satisfies Record<string, Transition>;

/** Spring presets for spring-driven interactions (heart pop, sheet, chip toggles). */
export const springs = {
  snappy: { type: "spring", stiffness: 300, damping: 30 },
  gentle: { type: "spring", stiffness: 120, damping: 14 },
  bouncy: { type: "spring", stiffness: 400, damping: 10 },
  instant: { type: "spring", stiffness: 600, damping: 35 },
  release: { type: "spring", stiffness: 200, damping: 20, restDelta: 0.001 },
} as const satisfies Record<string, Transition>;

/**
 * The continuous, transform-only loops — currently just the landing page's floating covers.
 *
 * **They are the one animation that is not an interaction**, so they cannot borrow from
 * `transitions` (which are all finite). Every value is still a token: a component that hardcoded
 * `duration: 7.5` would be the only place in the app whose timing nobody could find later.
 *
 * `repeatType: "mirror"` makes the animation ping-pong between the two `y` values, which is a
 * true sine. Writing `y: [0, -12, 0]` instead produces a visible seam where the last keyframe
 * hands back to the first.
 */
export const drifts = {
  cover: {
    duration: motionTokens.duration.drift,
    ease: motionTokens.easing.linear,
    repeat: Infinity,
    repeatType: "mirror" as const,
  },
} as const satisfies Record<string, Transition>;

/** Opacity-only duration cap enforced whenever reduced motion is preferred. */
export const REDUCED_MOTION_DURATION = 0.15;

/* -------------------------------------------------------------------------- */
/* Variant factories                                                           */
/* -------------------------------------------------------------------------- */

const buildFadeUp = (reduce: boolean, distance = motionTokens.distance.sm): Variants => ({
  hidden: { opacity: 0, y: reduce ? 0 : distance },
  visible: {
    opacity: 1,
    y: 0,
    transition: reduce ? transitions.fast : transitions.slow,
  },
});

const buildStagger = (reduce: boolean, step = motionTokens.stagger.list): Variants => ({
  hidden: {},
  visible: {
    transition: reduce
      ? { staggerChildren: 0, delayChildren: 0 }
      : { staggerChildren: step, delayChildren: step },
  },
});

const buildScaleIn = (reduce: boolean): Variants => ({
  hidden: { opacity: 0, scale: reduce ? 1 : motionTokens.scale.enter },
  visible: { opacity: 1, scale: 1, transition: transitions.base },
  exit: { opacity: 0, scale: reduce ? 1 : motionTokens.scale.enter, transition: transitions.fast },
});

const buildSlideIn = (reduce: boolean, distance = motionTokens.distance.lg): Variants => ({
  hidden: { opacity: 0, x: reduce ? 0 : distance },
  visible: { opacity: 1, x: 0, transition: transitions.base },
  exit: { opacity: 0, x: reduce ? 0 : distance, transition: transitions.fast },
});

/* -------------------------------------------------------------------------- */
/* Default variants (full motion)                                              */
/* -------------------------------------------------------------------------- */

/** Page transition: fade + 8px rise. */
export const fadeUp: Variants = buildFadeUp(false);
/** Parent wrapper that staggers `fadeUp`/`scaleIn` children by 40ms. */
export const stagger: Variants = buildStagger(false);
/** Dialog, popover and dropdown scale-in 0.97 → 1. */
export const scaleIn: Variants = buildScaleIn(false);
/** Horizontal entrance used by sheets and inline panels. */
export const slideIn: Variants = buildSlideIn(false);

/* -------------------------------------------------------------------------- */
/* Reduced-motion variants (transforms disabled, opacity fades only)            */
/* -------------------------------------------------------------------------- */

export const fadeUpReduced: Variants = buildFadeUp(true);
export const staggerReduced: Variants = buildStagger(true);
export const scaleInReduced: Variants = buildScaleIn(true);
export const slideInReduced: Variants = buildSlideIn(true);

/** Shared interaction props: cards lift 2px, buttons press to 0.98. */
export const hoverLift = {
  y: -2,
  transition: transitions.fast,
} as const;

export const pressScale = {
  scale: motionTokens.scale.press,
  transition: transitions.fast,
} as const;
