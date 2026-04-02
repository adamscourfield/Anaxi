import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  meta,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted/60">{eyebrow}</div>
          ) : null}
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-text">{title}</h1>
          {subtitle ? (
            <p className="max-w-full text-pretty text-[13px] leading-relaxed text-muted md:max-w-2xl">
              {subtitle}
            </p>
          ) : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
