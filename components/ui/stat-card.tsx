import Link from "next/link";
import { ReactNode } from "react";

type AccentColor = "accent" | "success" | "warning" | "error" | "info";

const accentBarColors: Record<AccentColor, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-[var(--info)]",
};

/** Panel tone for dashboard-style stat tiles (defaults preserve the original white card). */
type PanelTone = "default" | "softGrey" | "softBlueGrey" | "softWarm" | "glass";

const panelToneClass: Record<PanelTone, string> = {
  default: "border border-border/80 bg-surface-container-lowest shadow-ambient",
  softGrey: "border border-border/55 bg-surface-container-low shadow-none",
  softBlueGrey: "border border-border/45 bg-surface-container shadow-none",
  softWarm: "border border-coral/25 bg-coral-10 shadow-none",
  /** Solid floating KPI tile — matches Explorer / Signals summary cards */
  glass: "border border-border/80 bg-surface-container-lowest shadow-ambient",
};

/** `kpi`: icon row + chevron + stacked label/value/context (My Actions, Explorer-style tiles). */
type StatCardLayout = "default" | "kpi";

function KpiChevron() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-muted/50 calm-transition group-hover:text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  context,
  accent = "accent",
  href,
  tone = "softGrey",
  accentPlacement = "none",
  labelClassName,
  valueClassName,
  contextVariant = "below",
  layout = "default",
  icon,
  iconTileClassName,
  /** When `layout` is `kpi`, show chevron on the right (default: true if `href` is set). */
  showChevron,
}: {
  label: string;
  value: string | number;
  context?: ReactNode;
  accent?: AccentColor;
  href?: string;
  /** Softer grey / tinted panels for leave dashboard metrics */
  tone?: PanelTone;
  /** Top bar (default) or thick left edge; use `none` for a plain panel */
  accentPlacement?: "top" | "left" | "none";
  labelClassName?: string;
  valueClassName?: string;
  /** `inline`: secondary text baseline-aligned to the right of the value (Signals / Explorer KPI row) */
  contextVariant?: "below" | "inline";
  layout?: StatCardLayout;
  /** Shown in top-left when `layout` is `kpi` */
  icon?: ReactNode;
  /** Tile behind icon, e.g. tinted square */
  iconTileClassName?: string;
  showChevron?: boolean;
}) {
  const labelClasses =
    labelClassName ?? "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted";
  const valueClassesDefault =
    contextVariant === "inline"
      ? "text-[2rem] font-bold leading-none tracking-tight text-text"
      : "mt-1.5 text-[28px] font-bold leading-none tracking-[-0.02em] text-text";
  const valueClasses = valueClassName ?? valueClassesDefault;

  const kpiSurfaceClass =
    tone === "glass"
      ? "home-hero-glass border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)]"
      : panelToneClass[tone];

  if (layout === "kpi") {
    const showChev = showChevron ?? Boolean(href);
    const kpiBody = (
      <div className="relative flex min-h-[132px] flex-col p-5 sm:min-h-[140px] sm:p-6">
        <div className="flex items-start justify-between gap-2">
          {icon ? (
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5 ${iconTileClassName ?? "bg-[var(--surface-container-low)] text-muted"}`}
            >
              {icon}
            </span>
          ) : (
            <span />
          )}
          {href && showChev ? <KpiChevron /> : null}
        </div>
        <p className={`${labelClasses} mt-5`}>{label}</p>
        <p className={valueClassName ? `mt-1 ${valueClassName}` : "mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] text-text"}>{value}</p>
        {context ? <div className="mt-2 text-[0.8125rem] leading-snug text-muted">{context}</div> : null}
      </div>
    );

    const kpiInner = (
      <div className={`group overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.08)] ${kpiSurfaceClass}`}>
        {kpiBody}
      </div>
    );

    if (href) {
      return (
        <Link
          href={href}
          className="home-stat-drill block rounded-2xl outline-none transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]"
        >
          {kpiInner}
        </Link>
      );
    }

    return kpiInner;
  }

  const body =
    contextVariant === "inline" ? (
      <div className="min-w-0 flex-1 p-5">
        <p className={labelClasses}>{label}</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className={valueClasses}>{value}</span>
          {context != null &&
            (typeof context === "string" || typeof context === "number" ? (
              <span className="text-[0.8125rem] font-medium text-muted">{context}</span>
            ) : (
              <span className="min-w-0 text-[0.8125rem] leading-none">{context}</span>
            ))}
        </div>
      </div>
    ) : (
      <div className="min-w-0 flex-1 px-5 py-4">
        <p className={labelClasses}>{label}</p>
        <p className={valueClasses}>{value}</p>
        {context && <p className="mt-2 text-[12px] text-muted">{context}</p>}
      </div>
    );

  const inner = (
    <div className={`overflow-hidden rounded-xl ${panelToneClass[tone]}`}>
      {accentPlacement === "left" ? (
        <div className="flex min-h-[5.5rem]">
          <div className={`w-2 shrink-0 self-stretch ${accentBarColors[accent]}`} aria-hidden />
          {body}
        </div>
      ) : (
        <>
          {accentPlacement === "top" && <div className={`h-1 ${accentBarColors[accent]}`} />}
          {body}
        </>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="home-stat-drill block rounded-xl outline-none transition-[box-shadow,transform,background-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-lowest)]"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
