"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type TooltipState = { x: number; y: number; lines: string[] } | null;

const TOOLTIP_MARGIN = 10;
const TOOLTIP_GAP = 10;

function HeatmapTooltip({ state }: { state: TooltipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!state) { setPos(null); return; }
    const el = ref.current;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const w = el?.offsetWidth ?? 280;
    const h = el?.offsetHeight ?? 48;
    let left = state.x + TOOLTIP_GAP;
    let top = state.y + TOOLTIP_GAP;
    if (left + w + TOOLTIP_MARGIN > vw) left = state.x - w - TOOLTIP_GAP;
    if (top + h + TOOLTIP_MARGIN > vh) top = state.y - h - TOOLTIP_GAP;
    left = Math.min(Math.max(left, TOOLTIP_MARGIN), Math.max(TOOLTIP_MARGIN, vw - w - TOOLTIP_MARGIN));
    top = Math.min(Math.max(top, TOOLTIP_MARGIN), Math.max(TOOLTIP_MARGIN, vh - h - TOOLTIP_MARGIN));
    setPos({ left, top });
  }, [state]);

  if (!state || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-none fixed z-[100] max-w-[min(280px,calc(100vw-1.5rem))] rounded-sm border border-border bg-[var(--surface-container-lowest)] px-3.5 py-2.5 text-[0.8125rem] text-text shadow-none"
      style={{
        left: pos?.left ?? state.x + TOOLTIP_GAP,
        top: pos?.top ?? state.y + TOOLTIP_GAP,
        visibility: pos ? "visible" : "hidden",
      }}
      role="tooltip"
    >
      {state.lines.map((line, i) =>
        i === 0 ? (
          <p key={i} className="font-bold text-[#111827]">{line}</p>
        ) : (
          <p key={i} className="mt-0.5 text-[#6B7280]">{line}</p>
        ),
      )}
    </div>,
    document.body,
  );
}

export type SignalHeatmapCell = {
  key: string;
  barClass: string;
  label: string;
  mean: number | null | undefined;
  href: string;
};

export function SignalHeatmapClient({ cells }: { cells: SignalHeatmapCell[] }) {
  const router = useRouter();
  const [tip, setTip] = useState<TooltipState>(null);

  if (cells.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {cells.map((cell) => {
          const lines = [
            cell.label,
            cell.mean != null
              ? `${cell.mean.toFixed(2)} (1–4 scale; higher is stronger)`
              : "No data — click to view profile",
          ];
          if (cell.mean != null) lines.push("Click to view signal profile");
          return (
            <button
              key={cell.key}
              type="button"
              className={`h-5 w-5 shrink-0 cursor-pointer rounded-md ${cell.barClass} calm-transition hover:ring-2 hover:ring-neutral-950/25 hover:ring-offset-1 hover:ring-offset-surface-container-lowest`}
              onClick={(e) => { e.stopPropagation(); router.push(cell.href); }}
              onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, lines })}
              onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null))}
              onMouseLeave={() => setTip(null)}
              aria-label={`${cell.label}: ${cell.mean != null ? cell.mean.toFixed(2) : "No data"} — click to view signal profile`}
            />
          );
        })}
      </div>
      <HeatmapTooltip state={tip} />
    </>
  );
}
