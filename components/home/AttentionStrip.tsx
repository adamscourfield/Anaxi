import Link from "next/link";
import type { AttentionItem } from "@/modules/home/attentionItems";
import { attentionViewAllTarget } from "@/modules/home/attentionItems";

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  const displayItems = items.slice(0, 3);
  const hasCritical = items.some((item) => item.tone === "critical");
  const { href: viewAllHref, label: viewAllLabel } = attentionViewAllTarget(items);

  const shellClass = hasCritical
    ? "border-[color-mix(in_srgb,var(--error)_18%,transparent)] bg-[color-mix(in_srgb,var(--error)_03%,var(--surface-container-lowest))]"
    : "border-[color-mix(in_srgb,var(--warning)_16%,transparent)] bg-[color-mix(in_srgb,var(--pill-warning-bg)_40%,var(--surface-container-lowest))]";

  const dotClass = (tone: AttentionItem["tone"]) =>
    tone === "critical" ? "bg-[var(--error)]" : "bg-[var(--warning)]";

  return (
    <section className={`rounded-xl border px-4 py-3 sm:px-5 shadow-none ${shellClass}`}>
      <div className="flex flex-wrap items-start gap-3 lg:flex-nowrap lg:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 lg:flex-row lg:items-center lg:divide-x lg:divide-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)]">
          {displayItems.map((item) => (
            <Link
              key={`${item.title}-${item.href}`}
              href={item.href}
              className="group min-w-0 flex-1 rounded-lg py-0.5 calm-transition lg:px-4 first:lg:pl-0 hover:opacity-80"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(item.tone)}`} aria-hidden />
                <p className="truncate text-sm font-semibold text-text">{item.title}</p>
              </div>
              <p className="mt-0.5 truncate pl-4 text-xs text-muted">{item.detail}</p>
            </Link>
          ))}
        </div>
        <Link
          href={viewAllHref}
          className="shrink-0 self-center rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] bg-[var(--surface-container-lowest)] px-3.5 py-2 text-xs font-semibold text-text calm-transition hover:bg-[var(--surface-container-low)]"
        >
          {viewAllLabel} →
        </Link>
      </div>
    </section>
  );
}
