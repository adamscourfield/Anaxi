"use client";

import { usePathname } from "next/navigation";
import type { AnimationEvent, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  HVQT_DURATION_SEC,
  hvqtSlideEnterLayerClass,
  hvqtSlideExitLayerClass,
  hvqtSlideStageClass,
} from "@/lib/motion/hvqt";

/** Safety margin added to the CSS animation duration for the `animationend` fallback below. */
const EXIT_FALLBACK_BUFFER_MS = 400;

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
 * Route-keyed main content: the outgoing page glides left to reveal the
 * incoming page underneath, which pushes in slightly from the right — an
 * iOS nav-stack push (see `lib/motion/hvqt` + `globals.css`).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname() ?? "";
  const reduceMotion = usePrefersReducedMotion();
  const committedPathRef = useRef(pathname);
  const committedChildrenRef = useRef(children);
  const latestChildrenRef = useRef(children);
  latestChildrenRef.current = children;
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

  // Safety net: if `animationend` never fires on the exit layer (an interrupted
  // transition, a dropped frame, or any other browser quirk), `exiting` would
  // stay true forever and leave the page stuck under `.hvqt-slide-stage`'s
  // `overflow: hidden` — unable to scroll. Force the same cleanup `finishExit`
  // would have done once the animation should clearly be over.
  useEffect(() => {
    if (!exiting) return;
    const timeoutId = window.setTimeout(() => {
      committedPathRef.current = pathname;
      committedChildrenRef.current = latestChildrenRef.current;
      setExiting(false);
    }, HVQT_DURATION_SEC * 1000 + EXIT_FALLBACK_BUFFER_MS);
    return () => window.clearTimeout(timeoutId);
  }, [exiting, pathname]);

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  if (exiting) {
    return (
      <div className={mergeClassName(className, hvqtSlideStageClass)}>
        <div key={`enter-${pathname}`} className={hvqtSlideEnterLayerClass}>
          {children}
        </div>
        <div
          key={`exit-${committedPathRef.current}`}
          className={hvqtSlideExitLayerClass}
          onAnimationEnd={finishExit}
        >
          {committedChildrenRef.current}
        </div>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}
