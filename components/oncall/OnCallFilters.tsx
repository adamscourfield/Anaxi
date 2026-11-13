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

  const selectClass =
    "h-10 w-full min-w-0 rounded-[10px] border border-[#e5e5e6] bg-white pl-3 pr-9 text-[13px] font-medium text-[#1c1c1e] sm:w-auto sm:min-w-[168px]";
  // A filter that is doing something gets a dark outline, so a narrowed list is never mistaken for the full one.
  const activeStyle = { borderColor: "#1c1c1e", boxShadow: "inset 0 0 0 1px #1c1c1e" };

  return (
    <div
      role="group"
      aria-label="Filter on-call requests"
      className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:justify-end"
    >
      <select
        value={yearGroup ?? ""}
        onChange={(e) => router.push(buildOnCallHref(range, e.target.value || undefined, reason))}
        className={selectClass}
        style={yearGroup ? activeStyle : undefined}
        aria-label="Filter by year group"
      >
        <option value="">All year groups</option>
        {yearGroupOptions.map((yg) => (
          <option key={yg} value={yg}>
            {formatYearGroup(yg)}
          </option>
        ))}
      </select>

      <select
        value={reason ?? ""}
        onChange={(e) => router.push(buildOnCallHref(range, yearGroup, e.target.value || undefined))}
        className={selectClass}
        style={reason ? activeStyle : undefined}
        aria-label="Filter by behaviour reason"
      >
        <option value="">All reasons</option>
        {reasonOptions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      {hasFilters && (
        <Link
          href={buildOnCallHref(range)}
          className="link-muted-accent col-span-2 text-[13px] font-medium sm:col-span-1 sm:px-1"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
