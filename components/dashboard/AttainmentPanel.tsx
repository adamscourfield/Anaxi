import Link from "next/link";
import { HomeCardHeadingSm, IconChartBar } from "@/components/home/home-chrome";

export type AttainmentKPIRow = {
  label: string;
  value: number;
  /** +/- style delta, e.g. +0.24. If null, value is an absolute score (e.g. 48.7). */
  delta: number | null;
  sparkline: number[];
  href?: string;
};

export type AttainmentPanelProps = {
  rows: AttainmentKPIRow[];
  /** Subtitle shown below card title */
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

/** Minimal 40×20 SVG sparkline */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const W = 72;
  const H = 22;
  const pad = 2;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = pts.join(" ");

  // Area fill path
  const first = pts[0].split(",");
  const last = pts[pts.length - 1].split(",");
  const area = `M${first[0]},${H} L${polyline.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, "L$1,$2").slice(1)} L${last[0]},${H} Z`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <path
        d={area}
        fill="var(--coral)"
        fillOpacity="0.12"
      />
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--coral)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last dot */}
      <circle
        cx={last[0]}
        cy={last[1]}
        r="2.5"
        fill="var(--coral)"
      />
    </svg>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const positive = delta >= 0;
  const sign = positive ? "+" : "";
  return (
    <span
      className={`tabular-nums text-sm font-semibold ${
        positive ? "text-[var(--success)]" : "text-[var(--error)]"
      }`}
    >
      {sign}{delta.toFixed(2)}
    </span>
  );
}

export function AttainmentPanel({
  rows,
  subtitle,
  ctaHref = "/assessments",
  ctaLabel = "Go to attainment",
}: AttainmentPanelProps) {
  return (
    <div className="flex h-full flex-col gap-5">
      <HomeCardHeadingSm
        icon={<IconChartBar className="text-[var(--brand-blue)]" />}
        title="Attainment"
        subtitle={subtitle}
        end={
          <Link
            href={ctaHref}
            className="link-accent shrink-0 text-xs font-semibold"
          >
            View all →
          </Link>
        }
      />

      {/* KPI rows */}
      <div className="flex flex-1 flex-col divide-y divide-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 items-center gap-4 py-4 first:pt-0 last:pb-0">
            {/* Label */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">{row.label}</p>
            </div>

            {/* Sparkline */}
            <div className="shrink-0">
              <Sparkline values={row.sparkline} />
            </div>

            {/* Value / delta */}
            <div className="shrink-0 text-right">
              {row.delta !== null ? (
                <DeltaChip delta={row.delta} />
              ) : (
                <span className="tabular-nums text-sm font-semibold text-text">
                  {row.value.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-text calm-transition hover:text-muted"
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}
