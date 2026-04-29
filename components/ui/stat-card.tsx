import Link from "next/link";
import { ReactNode } from "react";

type AccentColor = "accent" | "success" | "warning" | "error" | "info";

const accentBarColors: Record<AccentColor, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-accent",
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
}) {
  const labelClasses =
    labelClassName ?? "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted";
  const valueClassesDefault =
    contextVariant === "inline"
      ? "text-[2rem] font-bold leading-none tracking-tight text-text"
      : "mt-1.5 text-[28px] font-bold leading-none tracking-[-0.02em] text-text";
  const valueClasses = valueClassName ?? valueClassesDefault;

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
    <div className={`overflow-hidden rounded-2xl ${panelToneClass[tone]}`}>
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
      <Link href={href} className="block calm-transition hover:shadow-lg rounded-2xl">
        {inner}
      </Link>
    );
  }

  return inner;
}
