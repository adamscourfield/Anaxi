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
            <div className={eyebrowClassName ?? "anx-eyebrow"}>{eyebrow}</div>
          ) : null}
          <h1 className={titleClassName ?? "anx-page-title"}>{title}</h1>
          {subtitle ? (
            <p className={subtitleClassName ?? "anx-page-subtitle"}>{subtitle}</p>
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
