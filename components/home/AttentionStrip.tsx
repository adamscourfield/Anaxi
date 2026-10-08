import Link from "next/link";
import type { ComponentType } from "react";
import type { AttentionItem, AttentionKind } from "@/modules/home/attentionItems";
import { attentionViewAllTarget } from "@/modules/home/attentionItems";
import { IconPhone, IconUsersTwo, IconTrendDown, IconUmbrella, IconFlagOutline } from "@/components/home/home-chrome";

const KIND_ICON: Record<AttentionKind, ComponentType<{ className?: string }>> = {
  onCall: IconPhone,
  intervention: IconUsersTwo,
  attendance: IconTrendDown,
  leave: IconUmbrella,
  studentRisk: IconFlagOutline,
};

const TONE_STYLES: Record<AttentionItem["tone"], { iconBg: string; iconText: string; ring: string }> = {
  critical: {
    iconBg: "bg-[color-mix(in_srgb,var(--error)_12%,transparent)]",
    iconText: "text-[var(--error)]",
    ring: "border-[color-mix(in_srgb,var(--error)_22%,transparent)] hover:border-[color-mix(in_srgb,var(--error)_38%,transparent)]",
  },
  warning: {
    iconBg: "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]",
    iconText: "text-[var(--warning)]",
    ring: "border-[color-mix(in_srgb,var(--warning)_26%,transparent)] hover:border-[color-mix(in_srgb,var(--warning)_42%,transparent)]",
  },
};

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  const displayItems = items.slice(0, 3);
  const criticalCount = items.filter((item) => item.tone === "critical").length;
  const { href: viewAllHref, label: viewAllLabel } = attentionViewAllTarget(items);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            {criticalCount > 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--error)] opacity-60" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${criticalCount > 0 ? "bg-[var(--error)]" : "bg-[var(--warning)]"}`} />
          </span>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
            Needs attention
          </h2>
        </div>
        <Link
          href={viewAllHref}
          className="shrink-0 text-xs font-semibold text-text calm-transition hover:text-muted"
        >
          {viewAllLabel} →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayItems.map((item) => {
          const Icon = KIND_ICON[item.kind];
          const tone = TONE_STYLES[item.tone];
          return (
            <Link
              key={`${item.title}-${item.href}`}
              href={item.href}
              className={`group flex items-start gap-3 rounded-xl border bg-[var(--surface-container-lowest)] p-3.5 calm-transition hover:-translate-y-0.5 hover:shadow-md ${tone.ring}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.iconBg} ${tone.iconText}`} aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{item.detail}</p>
              </div>
              <span className="mt-1 shrink-0 text-muted calm-transition group-hover:translate-x-0.5 group-hover:text-text" aria-hidden>
                →
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
