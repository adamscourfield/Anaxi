"use client";

import { useEffect, useRef } from "react";

/** Matches a secondary card to its neighbouring content card on wide screens. */
export function MatchSiblingHeight({
  targetId,
  children,
}: {
  targetId: string;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const target = document.getElementById(targetId);
    if (!wrapper || !target) return;

    const desktop = window.matchMedia("(min-width: 1280px)");
    const syncHeight = () => {
      wrapper.style.height = desktop.matches ? `${target.getBoundingClientRect().height}px` : "";
    };
    const observer = new ResizeObserver(syncHeight);
    observer.observe(target);
    desktop.addEventListener("change", syncHeight);
    syncHeight();

    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", syncHeight);
    };
  }, [targetId]);

  return <div ref={wrapperRef} className="min-h-0">{children}</div>;
}
