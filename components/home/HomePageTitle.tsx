import styles from "./LeadershipHeader.module.css";
import Link from "next/link";
import type { ReactNode } from "react";
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

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
  const leadership = ["SLT", "ADMIN", "SUPER_ADMIN"].includes(role);
  // One header for every role, so the home page reads as one product.
  return <header className={styles.header}>
    <div>
      <div className={styles.kicker}>{leadership && <><span>Leadership workspace</span><span className={styles.divider} aria-hidden="true"/></>}<span>{today}</span></div>
      <h1 className={styles.title}>{copy.title}<span>.</span></h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>
    </div>
    <div className={styles.actions}>
      {showWindowSelector ? <InsightWindowSelector windowDays={windowDays} extraQuery={windowExtraQuery} /> : null}
      {adminLink}
      {quickActionItems.length > 0 && <QuickActionButton items={quickActionItems}/>}
    </div>
  </header>;
}
