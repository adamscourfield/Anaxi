import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Major dashboard title — matches PageHeader scale */
export function HomePageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="anx-page-header-shell">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <p className="anx-eyebrow">{eyebrow}</p>
          ) : null}
          <h1 className="anx-page-title">{title}</h1>
          {subtitle ? (
            <p className="anx-page-subtitle">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

/** Section band header (e.g. Leave governance) */
export function HomeSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted/70">{eyebrow}</p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-text">{title}</h2>
        {description ? <p className="text-pretty text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Card row title with optional icon tile (10×10 accent or 8×8 neutral) */
export function HomeCardHeading({
  icon,
  iconVariant = "accent",
  title,
  subtitle,
  end,
}: {
  icon?: ReactNode;
  iconVariant?: "accent" | "neutral" | "muted";
  title: string;
  subtitle?: string;
  end?: ReactNode;
}) {
  const tile =
    iconVariant === "accent"
      ? "bg-[var(--tertiary-container)] text-[var(--on-primary)]"
      : iconVariant === "muted"
        ? "bg-[var(--surface-container)] text-muted"
        : "bg-[var(--surface-container)] text-text";

  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3.5">
        {icon ? (
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.06)] [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem] ${tile}`}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-[-0.01em] text-text">{title}</h2>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {end}
    </div>
  );
}

export function HomeCardHeadingSm({
  icon,
  title,
  subtitle,
  end,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  end?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container)] text-sm text-text [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-[-0.01em] text-text">{title}</h2>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {end}
    </div>
  );
}

/** Empty / zero-state panel inside a card */
export function HomeEmptyPanel({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl bg-[var(--surface-container-low)] px-5 py-8 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-container)] text-muted [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-pretty text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function HomePrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

/* ── Icons (replace emoji for consistent rendering) ───────────────── */

export function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChartBar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16v-5M12 16V8M17 16v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="m12 3 1.09 3.36h3.53l-2.86 2.08 1.09 3.36L12 9.73 8.15 11.8l1.09-3.36L6.38 6.36h3.53L12 3Z" strokeLinejoin="round" />
      <path d="M6 14.5 5 17l2.5-.5L8 19l1.5-2.5L12 17l-1-2.5 2.5.5L13 14l-2.5 1L12 11l-1.5 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" strokeLinecap="round" />
    </svg>
  );
}

export function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 4h6l1 2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3l1-2Z" strokeLinejoin="round" />
      <path d="M9 11h6M9 15h4" strokeLinecap="round" />
    </svg>
  );
}

export function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6L12 2z" />
    </svg>
  );
}

export function IconTrendUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="m4 16 6-6 4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrendDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="m4 8 6 6 4-4 6 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 18h6v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" strokeLinejoin="round" />
      <path d="M16 3v4M8 3v4M3 11h18" strokeLinecap="round" />
    </svg>
  );
}

export function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUmbrella({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3v1m0 0a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z" strokeLinejoin="round" />
      <path d="M12 13v8" strokeLinecap="round" />
    </svg>
  );
}
