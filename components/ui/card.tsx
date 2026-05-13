import { HTMLAttributes, ReactNode } from "react";

type CardTone = "default" | "subtle" | "inset" | "interactive";

// Cards: 1px border + micro-radius; flat (no shadow lift).
const toneClasses: Record<CardTone, string> = {
  default: "rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none",
  subtle: "rounded-sm bg-[var(--surface-container-low)]",
  inset: "rounded-sm bg-[var(--surface-container)]",
  interactive:
    "rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none calm-transition hover:bg-[var(--surface-container-low)] cursor-pointer",
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
    <div className={`rounded-sm p-5 sm:p-6 ${toneClasses[tone]} ${className}`} {...props}>
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
