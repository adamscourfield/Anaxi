import type { Transition, Variants } from "framer-motion";
import { MOTION_EASE_FRAMER, MOTION_PANEL_SEC } from "@/lib/motion/tokens";

/** Panel / route duration in seconds (see `lib/motion/tokens.ts`). */
export const HVQT_DURATION_SEC = MOTION_PANEL_SEC;

/** Fast-start deceleration — shared with CSS `var(--motion-ease-hvqt)`. */
export const HVQT_EASE = MOTION_EASE_FRAMER;

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

/** Modals and floating panels: same curve, smaller travel and blur than route content. */
export const panelSnapFocusVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
    filter: "blur(2px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(2px)",
  },
};
