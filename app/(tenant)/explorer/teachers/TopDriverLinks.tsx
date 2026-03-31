"use client";

import Link from "next/link";

export type TopDriverItem = { signalKey: string; delta: number };

type Props = {
  drivers: TopDriverItem[];
  labelByKey: Record<string, string>;
  windowDays: number;
  truncateLabel: (label: string, max?: number) => string;
};

export function TopDriverLinks({ drivers, labelByKey, windowDays, truncateLabel }: Props) {
  if (drivers.length === 0) {
    return <span className="text-muted">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {drivers.map((d) => {
        const label = truncateLabel(labelByKey[d.signalKey] ?? d.signalKey);
        const isDrift = d.delta < 0;
        return (
          <Link
            key={d.signalKey}
            href={`/analysis/cpd/${d.signalKey}?window=${windowDays}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium calm-transition hover:opacity-70 ${
              isDrift
                ? "bg-scale-limited-light text-scale-limited-text"
                : "bg-scale-strong-light text-scale-strong-text"
            }`}
          >
            {isDrift ? "↓" : "↑"} {label}
          </Link>
        );
      })}
    </div>
  );
}
