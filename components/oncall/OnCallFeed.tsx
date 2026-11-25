"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LiveIndicator,
  STATUS_DISPLAY,
  StatusTag,
  TypeTag,
  formatClock,
  formatYearGroup,
  useLiveRefresh,
  type OnCallStatus,
  type OnCallType,
} from "./shared";
import styles from "./OnCallInbox.module.css";

export interface FeedRow {
  id: string;
  status: OnCallStatus;
  requestType: OnCallType;
  isEmergency: boolean;
  location: string;
  reason: string | null;
  createdAt: string;
  student: { fullName: string; yearGroup: string | null };
  requester: string;
  responder: string | null;
}

const STATUS_ORDER: OnCallStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "CANCELLED"];
const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73]";

export function OnCallFeed({
  rows,
  status,
  yearGroup,
  counts,
  yearGroupOptions,
}: {
  rows: FeedRow[];
  status: string;
  yearGroup: string;
  counts: Record<string, number>;
  yearGroupOptions: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatedAt, now } = useLiveRefresh();
  const total = STATUS_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  function hrefWith(next: { status?: string; yearGroup?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    return qs ? `/on-call/feed?${qs}` : "/on-call/feed";
  }

  const backTo = encodeURIComponent(hrefWith({}));
  const detailHref = (id: string) => `/on-call/${id}?from=${backTo}`;
  const filtersActive = Boolean(status || yearGroup);

  const chips: { value: string; label: string; count: number }[] = [
    { value: "", label: "All", count: total },
    ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_DISPLAY[s].label, count: counts[s] ?? 0 })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const active = chip.value === status;
              return (
                <Link
                  key={chip.label}
                  href={hrefWith({ status: chip.value })}
                  replace
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium transition-colors ${
                    active
                      ? "border-[#1c1c1e] bg-[#1c1c1e] text-white"
                      : "border-[#e5e5e6] bg-white text-[#1c1c1e] hover:border-[#a1a1aa]"
                  }`}
                >
                  {chip.label}
                  <span className={`tabular-nums ${active ? "text-white/70" : "text-[#6e6e73]"}`}>{chip.count}</span>
                </Link>
              );
            })}
          </nav>
          <select
            value={yearGroup}
            onChange={(e) => router.replace(hrefWith({ yearGroup: e.target.value }), { scroll: false })}
            aria-label="Filter by year group"
            className={`${styles.select} h-9`}
            style={yearGroup ? { borderColor: "#1c1c1e", boxShadow: "inset 0 0 0 1px #1c1c1e" } : undefined}
          >
            <option value="">All year groups</option>
            {yearGroupOptions.map((yg) => (
              <option key={yg} value={yg}>
                {formatYearGroup(yg)}
              </option>
            ))}
          </select>
        </div>
        <LiveIndicator updatedAt={updatedAt} now={now} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          mode="embedded"
          title={filtersActive ? "Nothing matches these filters today" : "Nothing raised yet today"}
          description={
            filtersActive
              ? "Try another status or year group."
              : "Call-outs appear here as soon as they're raised, and stay for the rest of the day."
          }
          action={
            filtersActive ? (
              <Link href="/on-call/feed" replace className="text-[13px] font-medium text-[#1c1c1e] underline underline-offset-4">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.tableCard}>
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className={styles.headRow}>
                <th className={`${TH} w-[84px] pl-5`}>Time</th>
                <th className={TH}>Student</th>
                <th className={TH}>Type</th>
                <th className={TH}>Location</th>
                <th className={TH}>Raised by</th>
                <th className={`${TH} pr-5`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`${styles.row} cursor-pointer`}
                  data-emergency={r.isEmergency && (r.status === "OPEN" || r.status === "ACKNOWLEDGED") ? "" : undefined}
                  onClick={() => router.push(detailHref(r.id))}
                >
                  <td className="py-3.5 pl-5 pr-4 font-semibold tabular-nums text-[#1c1c1e]">{formatClock(r.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={detailHref(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-[#1c1c1e] hover:underline"
                    >
                      {r.student.fullName}
                    </Link>
                    <span className="block text-[12px] text-[#6e6e73]">{formatYearGroup(r.student.yearGroup)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <TypeTag type={r.requestType} emergency={r.isEmergency} />
                    {r.reason ? <span className="block text-[12px] text-[#6e6e73]">{r.reason}</span> : null}
                  </td>
                  <td className="px-4 py-3.5 text-[#1c1c1e]">{r.location}</td>
                  <td className="px-4 py-3.5 text-[#3a3a3c]">{r.requester}</td>
                  <td className="py-3.5 pl-4 pr-5">
                    <StatusTag status={r.status} />
                    {r.responder && r.status !== "OPEN" ? (
                      <span className="block pt-1 text-[12px] text-[#6e6e73]">{r.responder}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
