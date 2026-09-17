"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResolvedHistoryRange } from "@/modules/oncall/types";

function formatYearGroup(yearGroup: string): string {
  const digits = yearGroup.replace(/\D/g, "");
  return `Year ${digits || yearGroup}`;
}

function buildOnCallHref(range: ResolvedHistoryRange, yearGroup?: string, reason?: string): string {
  const params = new URLSearchParams();
  if (range !== "today") params.set("range", range);
  if (yearGroup) params.set("yearGroup", yearGroup);
  if (reason) params.set("reason", reason);
  const q = params.toString();
  return q ? `/on-call?${q}` : "/on-call";
}

export function OnCallFilters({
  range,
  yearGroup,
  reason,
  yearGroupOptions,
  reasonOptions,
}: {
  range: ResolvedHistoryRange;
  yearGroup?: string;
  reason?: string;
  yearGroupOptions: string[];
  reasonOptions: readonly string[];
}) {
  const router = useRouter();
  const hasFilters = Boolean(yearGroup) || Boolean(reason);

  return (
    <div className="filter-panel">
      <div className="filter-bar flex-wrap items-end gap-4">
        <label className="flex min-w-0 flex-col gap-1.5 sm:min-w-[180px]">
          <span className="filter-field-label">Year group</span>
          <select
            value={yearGroup ?? ""}
            onChange={(e) => router.push(buildOnCallHref(range, e.target.value || undefined, reason))}
            className="field field-filter-trigger min-w-0 !py-2.5 !text-sm"
            aria-label="Filter by year group"
          >
            <option value="">All year groups</option>
            {yearGroupOptions.map((yg) => (
              <option key={yg} value={yg}>
                {formatYearGroup(yg)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1.5 sm:min-w-[200px]">
          <span className="filter-field-label">Behaviour reason</span>
          <select
            value={reason ?? ""}
            onChange={(e) => router.push(buildOnCallHref(range, yearGroup, e.target.value || undefined))}
            className="field field-filter-trigger min-w-0 !py-2.5 !text-sm"
            aria-label="Filter by behaviour reason"
          >
            <option value="">All reasons</option>
            {reasonOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {hasFilters && (
          <Link
            href={buildOnCallHref(range)}
            className="btn-filter-secondary text-center no-underline"
          >
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}
