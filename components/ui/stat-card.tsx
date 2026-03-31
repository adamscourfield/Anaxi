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
type PanelTone = "default" | "softGrey" | "softBlueGrey" | "softWarm";

const panelToneClass: Record<PanelTone, string> = {
  default: "border border-border/80 bg-surface-container-lowest shadow-sm",
  softGrey: "border border-black/[0.06] bg-[#F1F3F5] shadow-none",
  softBlueGrey: "border border-black/[0.05] bg-[#E9EEF4] shadow-none",
  softWarm: "border border-[#e8d9dc]/80 bg-[#F3EDEE] shadow-none",
};

export function StatCard({
  label,
  value,
  context,
  accent = "accent",
  href,
  tone = "default",
  accentPlacement = "top",
  labelClassName,
  valueClassName,
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
}) {
  const labelClasses =
    labelClassName ?? "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted";
  const valueClasses =
    valueClassName ?? "mt-1.5 text-[28px] font-bold leading-none tracking-[-0.02em] text-text";

  const body = (
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
      <Link href={href} className="block calm-transition hover:shadow-md rounded-2xl">
        {inner}
      </Link>
    );
  }

  return inner;
}
