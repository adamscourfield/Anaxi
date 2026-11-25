"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import styles from "./meetings.module.css";

function buildMeetingsHref(scope: "all" | "mine", type?: string): string {
  const params = new URLSearchParams();
  if (scope === "mine") params.set("scope", "mine");
  if (type) params.set("type", type);
  const q = params.toString();
  return q ? `/meetings?${q}` : "/meetings";
}

export function MeetingsFilters({ canViewAll, scope, type }: { canViewAll: boolean; scope: "all" | "mine"; type?: string }) {
  const router = useRouter();
  const hasFilters = (canViewAll && scope === "mine") || Boolean(type);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter meetings">
      {canViewAll ? (
        <nav className={styles.segmented} aria-label="Whose meetings">
          <Link href={buildMeetingsHref("all", type)} replace scroll={false} aria-current={scope === "all" ? "page" : undefined}>
            Everyone&rsquo;s
          </Link>
          <Link href={buildMeetingsHref("mine", type)} replace scroll={false} aria-current={scope === "mine" ? "page" : undefined}>
            Mine
          </Link>
        </nav>
      ) : null}
      <select
        value={type ?? ""}
        onChange={(e) => router.replace(buildMeetingsHref(scope, e.target.value || undefined), { scroll: false })}
        className={styles.select}
        data-active={type || undefined}
        aria-label="Meeting type"
      >
        <option value="">All types</option>
        {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {hasFilters ? (
        <Link href="/meetings" replace scroll={false} className="px-1 text-[13px] font-medium text-[#1c1c1e] underline-offset-4 hover:underline">
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}
