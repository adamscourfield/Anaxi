"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";

function buildMeetingsHref(scope: "all" | "mine", type?: string): string {
  const params = new URLSearchParams();
  if (scope === "mine") params.set("scope", "mine");
  if (type) params.set("type", type);
  const q = params.toString();
  return q ? `/meetings?${q}` : "/meetings";
}

export function MeetingsFilters({
  canViewAll,
  scope,
  type,
}: {
  canViewAll: boolean;
  scope: "all" | "mine";
  type?: string;
}) {
  const router = useRouter();
  const hasFilters = scope === "mine" || Boolean(type);

  return (
    <div className="filter-panel">
      <div className="filter-bar flex-wrap items-end gap-4">
        {canViewAll && (
          <div>
            <span className="filter-field-label mb-1.5 block">Show</span>
            <div className="filter-period-toggle">
              <Link
                href={buildMeetingsHref("all", type)}
                className={`filter-period-btn ${scope === "all" ? "filter-period-btn-active" : ""}`}
              >
                All meetings
              </Link>
              <Link
                href={buildMeetingsHref("mine", type)}
                className={`filter-period-btn ${scope === "mine" ? "filter-period-btn-active" : ""}`}
              >
                My meetings
              </Link>
            </div>
          </div>
        )}

        <label className="flex min-w-0 flex-col gap-1.5 sm:min-w-[200px]">
          <span className="filter-field-label">Meeting type</span>
          <select
            value={type ?? ""}
            onChange={(e) => {
              const nextType = e.target.value || undefined;
              router.push(buildMeetingsHref(scope, nextType));
            }}
            className="field field-filter-trigger min-w-0 !py-2.5 !text-sm"
            aria-label="Filter by meeting type"
          >
            <option value="">All types</option>
            {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <Link href="/meetings" className="btn-filter-secondary text-center no-underline">
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}
