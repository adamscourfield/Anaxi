"use client";

import { usePathname } from "next/navigation";
import type { AnimationEvent, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  hvqtPageEnterClass,
  hvqtPageExitClass,
} from "@/lib/motion/hvqt";

type PageTransitionProps = {
  children: ReactNode;
  /** Layout wrapper classes (width, max-width, etc.). */
  className?: string;
};

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduce;
}

function mergeClassName(base: string | undefined, extra: string): string {
  return [base, extra].filter(Boolean).join(" ");
}

/**
 * Route-keyed main content: exit-then-enter (AnimatePresence `mode="wait"`)
 * with opacity, 10px Y, and 4px blur (see `lib/motion/hvqt` + `globals.css`).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname() ?? "";
  const reduceMotion = usePrefersReducedMotion();
  const committedPathRef = useRef(pathname);
  const committedChildrenRef = useRef(children);
  const [exiting, setExiting] = useState(false);

  useLayoutEffect(() => {
    if (!exiting && pathname === committedPathRef.current) {
      committedChildrenRef.current = children;
    }
  }, [children, exiting, pathname]);

  useLayoutEffect(() => {
    if (reduceMotion) return;
    if (pathname === committedPathRef.current) return;
    setExiting(true);
  }, [pathname, reduceMotion]);

  const finishExit = useCallback(
    (e: AnimationEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      committedPathRef.current = pathname;
      committedChildrenRef.current = children;
      setExiting(false);
    },
    [children, pathname],
  );

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  if (exiting) {
    return (
      <div
        key={`exit-${committedPathRef.current}`}
        className={mergeClassName(className, hvqtPageExitClass)}
        onAnimationEnd={finishExit}
      >
        {committedChildrenRef.current}
      </div>
    );
  }

  return (
    <div key={`enter-${pathname}`} className={mergeClassName(className, hvqtPageEnterClass)}>
      {children}
    </div>
  );
}
