import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  meta,
  className = "mb-8",
  eyebrowClassName,
  titleClassName,
  subtitleClassName,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  className?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <div
              className={
                eyebrowClassName ??
                "text-2xs font-semibold uppercase tracking-[0.12em] text-muted/60"
              }
            >
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={
              titleClassName ??
              "text-3xl font-bold leading-tight tracking-[-0.03em] text-text"
            }
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={
                subtitleClassName ??
                "max-w-full text-pretty text-sm leading-relaxed text-muted md:max-w-2xl"
              }
            >
              {subtitle}
            </p>
          ) : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-0.5">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
