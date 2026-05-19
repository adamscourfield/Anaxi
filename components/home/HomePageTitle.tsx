import Link from "next/link";
import type { ReactNode } from "react";
import { HomePageHeader } from "@/components/home/home-chrome";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";
import { InsightWindowSelector } from "@/components/home/InsightWindowSelector";
import type { HomeHeaderCopy } from "@/modules/home/headerCopy";
import { UserRole } from "@/lib/types";

export function HomePageTitle({
  copy,
  windowDays,
  showWindowSelector,
  windowExtraQuery,
  quickActionItems,
  role,
}: {
  copy: HomeHeaderCopy;
  windowDays: number;
  showWindowSelector: boolean;
  windowExtraQuery?: string;
  quickActionItems: { label: string; href: string; icon: ReactNode }[];
  role: UserRole;
}) {
  const adminLink =
    role === "ADMIN" ? (
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] px-3 py-2 text-xs font-semibold text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text"
      >
        Platform setup →
      </Link>
    ) : null;

  return (
    <HomePageHeader
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={copy.subtitle}
      actions={
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {showWindowSelector ? (
            <div className="min-w-0 flex-1 sm:flex-initial">
              <InsightWindowSelector windowDays={windowDays} extraQuery={windowExtraQuery} />
            </div>
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-center">
            {adminLink}
            {quickActionItems.length > 0 ? <QuickActionButton items={quickActionItems} /> : null}
          </div>
        </div>
      }
    />
  );
}
