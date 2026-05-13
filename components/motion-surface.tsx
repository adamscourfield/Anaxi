"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { hvqtTransition, pageSnapFocusVariants, panelSnapFocusVariants } from "@/lib/motion/hvqt";

const presetVariants = {
  route: pageSnapFocusVariants,
  panel: panelSnapFocusVariants,
} as const;

export type MotionSurfacePreset = keyof typeof presetVariants;

type MotionSurfaceProps = {
  children: ReactNode;
  className?: string;
  /** `route` matches main column snap-to-focus; `panel` is lighter for overlays. */
  preset?: MotionSurfacePreset;
};

/**
 * Shared HVQT enter state for surfaces. For full route cross-fades with exit,
 * use `PageTransition` (AnimatePresence) instead.
 */
export function MotionSurface({ children, className, preset = "panel" }: MotionSurfaceProps) {
  return (
    <motion.div
      className={className}
      variants={presetVariants[preset]}
      initial="initial"
      animate="animate"
      transition={hvqtTransition}
    >
      {children}
    </motion.div>
  );
}
