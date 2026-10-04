import { ReactNode } from "react";

function cn(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ").trim();
}

export type PageHeaderVariant = "default" | "ledger";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  meta,
  avatar,
  /** Default is ledger (institutional shell) — use across tenant app for consistency. */
  variant = "ledger",
  className,
  eyebrowClassName,
  titleClassName,
  subtitleClassName,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  /** Optional person or organisation image displayed beside the title. */
  avatar?: ReactNode;
  /** `ledger`: institutional shell + scaled title (use across tenant app). */
  variant?: PageHeaderVariant;
  className?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  const rootClass =
    variant === "ledger"
      ? cn("anx-page-header-shell", className)
      : cn("mb-8", className);

  const eyebrowDefault =
    variant === "ledger"
      ? "anx-eyebrow"
      : "text-2xs font-semibold uppercase tracking-[0.12em] text-muted/60";
  const titleDefault =
    variant === "ledger"
      ? "anx-page-title"
      : "font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-text";
  const subtitleDefault =
    variant === "ledger"
      ? "anx-page-subtitle"
      : "max-w-full text-pretty text-sm leading-relaxed text-muted md:max-w-2xl";

  return (
    <div className={rootClass}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {avatar ? <div className="pt-0.5">{avatar}</div> : null}
          <div className="min-w-0 space-y-2">
            {eyebrow ? (
              <div className={eyebrowClassName ?? eyebrowDefault}>{eyebrow}</div>
            ) : null}
            <h1 className={titleClassName ?? titleDefault}>{title}</h1>
            {subtitle ? (
              <p className={subtitleClassName ?? subtitleDefault}>{subtitle}</p>
            ) : null}
            {meta ? <div className="flex flex-wrap items-center gap-2 pt-0.5">{meta}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
