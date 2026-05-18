"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipState = { x: number; y: number; text: string } | null;

const TOOLTIP_MARGIN = 10;
const TOOLTIP_GAP = 10;

function SignalTooltip({ state }: { state: TooltipState }) {
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

  const lines = state.text.split("\n");

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
      <div className="whitespace-pre-wrap">
        {lines.map((line, i) =>
          i === 0 ? (
            <p key={i} className="font-bold text-[#111827]">{line}</p>
          ) : (
            <p key={i} className="mt-0.5 text-[#6B7280]">{line}</p>
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}

export function SignalDotsClient({
  signals,
}: {
  signals: { colorClass: string; tooltip: string }[];
}) {
  const [tip, setTip] = useState<TooltipState>(null);

  if (signals.length === 0) return <span className="text-xs text-muted">—</span>;

  function formatTooltip(raw: string): string {
    // "Signal — Level: Description" → "Signal — Level\nDescription"
    const colonIdx = raw.indexOf(": ");
    if (colonIdx === -1) return raw;
    return raw.slice(0, colonIdx) + "\n" + raw.slice(colonIdx + 2);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5">
        {signals.map((s, i) => (
          <span
            key={i}
            className={`inline-block h-2.5 w-2.5 shrink-0 cursor-help rounded-sm ${s.colorClass}`}
            onMouseEnter={(e) =>
              setTip({ x: e.clientX, y: e.clientY, text: formatTooltip(s.tooltip) })
            }
            onMouseMove={(e) =>
              setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null))
            }
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </div>
      <SignalTooltip state={tip} />
    </>
  );
}
