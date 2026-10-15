import styles from "./LeadershipHeader.module.css";
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

  if (["SLT", "ADMIN", "SUPER_ADMIN"].includes(role)) {
    const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
    return <header className={styles.header}>
      <div>
        <div className={styles.kicker}><span>Leadership workspace</span><span className={styles.divider} aria-hidden="true"/><span>{today}</span></div>
        <h1 className={styles.title}>{copy.title}<span>.</span></h1>
        <p className={styles.subtitle}>{copy.subtitle}</p>
      </div>
      <div className={styles.actions}>{adminLink}{quickActionItems.length > 0 && <QuickActionButton items={quickActionItems}/>}</div>
    </header>;
  }

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
