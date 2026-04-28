import type { ReactNode } from "react";
import { MetaText } from "@/components/ui/typography";

/** Empty state for wide data cards (analytics tables, explorer lists) */
export function DataTableEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-low)] text-muted">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6" aria-hidden>
          <path d="M9 12h6M12 9v6" strokeLinecap="round" />
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        </svg>
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {description ? <MetaText className="mx-auto mt-1 max-w-md">{description}</MetaText> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
