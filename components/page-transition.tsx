"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { hvqtTransition, pageSnapFocusVariants } from "@/lib/motion/hvqt";

type PageTransitionProps = {
  children: ReactNode;
  /** Layout wrapper classes (width, max-width, etc.). */
  className?: string;
};

/**
 * Route-keyed main content: AnimatePresence `mode="wait"` + synchronized
 * opacity, 10px Y, and 4px blur (see `lib/motion/hvqt`).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname ?? ""}
        className={className}
        variants={pageSnapFocusVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={hvqtTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
