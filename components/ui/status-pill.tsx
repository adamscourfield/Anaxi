import { ReactNode } from "react";

export type PillVariant = "error" | "warning" | "success" | "neutral" | "info" | "accent";
export type PillSize = "sm" | "md";

const pillClasses: Record<PillVariant, string> = {
  error: "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]",
  warning: "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)] ring-1 ring-inset ring-[var(--pill-warning-ring)]",
  success: "bg-[var(--pill-success-bg)] text-[var(--pill-success-text)] ring-1 ring-inset ring-[var(--pill-success-ring)]",
  neutral: "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-text)] ring-1 ring-inset ring-[var(--pill-neutral-ring)]",
  info: "bg-[var(--pill-info-bg)] text-[var(--pill-info-text)] ring-1 ring-inset ring-[var(--pill-info-ring)]",
  accent: "bg-[var(--pill-accent-bg)] text-[var(--pill-accent-text)] ring-1 ring-inset ring-[var(--pill-accent-ring)]",
};

const sizeClasses: Record<PillSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export function StatusPill({
  variant,
  size = "md",
  children,
  className = "",
}: {
  variant: PillVariant;
  size?: PillSize;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium tracking-[0.01em] ${pillClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}
