import { HTMLAttributes, ReactNode } from "react";

type CardTone = "default" | "subtle" | "inset" | "interactive";

// No-Line Rule: boundaries defined by background color shifts, not borders.
// Cards use surface-container-lowest (white) on surface-container-low backgrounds.
const toneClasses: Record<CardTone, string> = {
  default:
    "border border-[color-mix(in_srgb,var(--outline-variant)_11%,transparent)] bg-[var(--surface-container-lowest)] shadow-ambient",
  subtle:      "bg-[var(--surface-container-low)]",
  inset:       "bg-[var(--surface-container)]",
  interactive:
    "border border-[color-mix(in_srgb,var(--outline-variant)_11%,transparent)] bg-[var(--surface-container-lowest)] shadow-ambient calm-transition hover:bg-[var(--surface-container-low)] hover:shadow-lg motion-safe:hover:-translate-y-px cursor-pointer",
};

export function Card({
  children,
  className = "",
  tone = "default",
  ...props
}: {
  children: ReactNode;
  className?: string;
  tone?: CardTone;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl p-5 sm:p-6 ${toneClasses[tone]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function InteractiveCard({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <Card tone="interactive" className={className} {...props}>
      {children}
    </Card>
  );
}
