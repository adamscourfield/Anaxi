import type { Transition, Variants } from "framer-motion";

/** High-Velocity Quintic-style motion: fast start, long precision settle (300ms). */
export const HVQT_DURATION_SEC = 0.3;

/** Fast-start deceleration — “frontier lab” chart and page motion curve. */
export const HVQT_EASE = [0.22, 1, 0.36, 1] as const;

export const hvqtTransition: Transition = {
  duration: HVQT_DURATION_SEC,
  ease: HVQT_EASE,
};

/**
 * Snap-to-focus: enters from below + soft blur, exits continuing upward + blur.
 * Opacity, Y, and blur stay on one easing curve for a refocus-style feel.
 */
export const pageSnapFocusVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(4px)",
  },
};
