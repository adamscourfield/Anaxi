"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeaveCalendarRequestJson } from "@/modules/leave/leaveCalendarMonthData";
import {
  WEEKDAYS,
  stripTime,
  daysSpan,
  monthOverlapRange,
  localDayKey,
  calendarTitleForRequest,
  continuationLabel,
} from "./leave-calendar-helpers";

type CalendarContinuationBlock = { key: string; type: "continuation"; request: LeaveCalendarRequestJson };
type CalendarEventBlock = {
  key: string;
  type: "event";
  request: LeaveCalendarRequestJson;
  accentBar: string;
  cardBg: string;
  cardBorder: string;
  titleClass: string;
  subClass: string;
  title: string;
  showSpanDot: boolean;
};
type CalendarBlock = CalendarContinuationBlock | CalendarEventBlock;

type BasePath = "calendar" | "leave";

type Props = {
  /** `YYYY-MM` for the initially displayed month */
  initialMonthKey: string;
  initialRequests: LeaveCalendarRequestJson[];
  basePath: BasePath;
};

function monthKeyFromAnchor(anchor: Date): string {
  return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
}

function anchorFromMonthKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return new Date(y, mo - 1, 1);
}

/** Sun-first cells: leading outside month, current month days, trailing outside month; length is a multiple of 7. */
function buildMonthGridCells(monthAnchor: Date): { date: Date; inMonth: boolean }[] {
  const y = monthAnchor.getFullYear();
  const mo = monthAnchor.getMonth();
  const first = new Date(y, mo, 1);
  const dim = new Date(y, mo + 1, 0).getDate();
  const padStart = first.getDay();
  const dimPrev = new Date(y, mo, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < padStart; i++) {
    const day = dimPrev - padStart + 1 + i;
    cells.push({ date: new Date(y, mo - 1, day), inMonth: false });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({ date: new Date(y, mo, d), inMonth: true });
  }
  const total = cells.length;
  const trail = (7 - (total % 7)) % 7;
  for (let j = 1; j <= trail; j++) {
    cells.push({ date: new Date(y, mo + 1, j), inMonth: false });
  }
  return cells;
}

function startCardVisuals(status: string): {
  accentBar: string;
  cardBg: string;
  cardBorder: string;
  titleClass: string;
  subClass: string;
} {
  if (status === "APPROVED") {
    return {
      accentBar: "bg-[#16a34a]",
      cardBg: "bg-[#ECFDF5]",
      cardBorder: "border-[#D1FAE5]",
      titleClass: "text-[#15803d]",
      subClass: "text-[#166534]/90",
    };
  }
  if (status === "DENIED") {
    return {
      accentBar: "bg-[#dc2626]",
      cardBg: "bg-[#FEF2F2]",
      cardBorder: "border-[#FECACA]",
      titleClass: "text-[#b91c1c]",
      subClass: "text-[#991b1b]/90",
    };
  }
  return {
    accentBar: "bg-[#64748b]",
    cardBg: "bg-[#F8FAFC]",
    cardBorder: "border-[#E2E8F0]",
    titleClass: "text-[#334155]",
    subClass: "text-[#475569]",
  };
}

export function LeaveCalendarGrid({ initialMonthKey, initialRequests, basePath }: Props) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [requests, setRequests] = useState<LeaveCalendarRequestJson[]>(initialRequests);
  const [loading, setLoading] = useState(false);
  const [animTick, setAnimTick] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setMonthKey(initialMonthKey);
    setRequests(initialRequests);
  }, [initialMonthKey, initialRequests]);
  const calStart = useMemo(() => new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1), [monthAnchor]);
  const calEnd = useMemo(
    () =>
      new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0, 23, 59, 59),
    [monthAnchor],
  );

  const monthLabel = calStart.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const gridCells = useMemo(() => buildMonthGridCells(monthAnchor), [monthAnchor]);
  const todayKey = localDayKey(new Date());

  const hrefForMonth = useCallback(
    (key: string) =>
      basePath === "calendar" ? `/leave/calendar?month=${key}` : `/leave?view=calendar&month=${key}`,
    [basePath],
  );

  const requestHrefForId = useCallback(
    (id: string) =>
      basePath === "calendar"
        ? `/leave/${id}?from=calendar&month=${monthKey}`
        : `/leave/${id}?from=calendar&month=${monthKey}`,
    [basePath, monthKey],
  );

  const goToMonth = useCallback(
    async (nextKey: string) => {
      if (nextKey === monthKey) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/leave/calendar-month?month=${encodeURIComponent(nextKey)}`, {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("Failed to load month");
        const data = (await res.json()) as { requests: LeaveCalendarRequestJson[] };
        setMonthKey(nextKey);
        setRequests(data.requests);
        router.replace(hrefForMonth(nextKey), { scroll: false });
        setAnimTick((t) => t + 1);
      } catch {
        /* keep current month on error */
      } finally {
        setLoading(false);
      }
    },
    [monthKey, router, hrefForMonth],
  );

  const prevMonthKey = useMemo(() => {
    const d = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1);
    return monthKeyFromAnchor(d);
  }, [monthAnchor]);

  const nextMonthKey = useMemo(() => {
    const d = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);
    return monthKeyFromAnchor(d);
  }, [monthAnchor]);

  const jumpToday = useCallback(() => {
    const tk = monthKeyFromAnchor(new Date());
    void goToMonth(tk);
    setSelectedKey(localDayKey(new Date()));
  }, [goToMonth]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <h2 className="text-[1.35rem] font-bold capitalize tracking-tight text-[#111827] sm:text-[1.5rem]">
            {monthLabel}
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => void goToMonth(prevMonthKey)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] calm-transition hover:bg-[#F3F4F6] hover:text-[#111827] disabled:opacity-40"
              aria-label="Previous month"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void goToMonth(nextMonthKey)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] calm-transition hover:bg-[#F3F4F6] hover:text-[#111827] disabled:opacity-40"
              aria-label="Next month"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Leave status legend">
            <span
              role="listitem"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#9CA3AF]" aria-hidden />
              Pending
            </span>
            <span
              role="listitem"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" aria-hidden />
              Approved
            </span>
            <span
              role="listitem"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" aria-hidden />
              Declined
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={jumpToday}
              className="rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 py-2 text-[0.8125rem] font-semibold text-[#111827] shadow-sm calm-transition hover:bg-[#F9FAFB]"
            >
              Today
            </button>
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] text-[#6B7280] shadow-sm"
              title="Calendar"
              aria-hidden
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
            </span>
            <Link
              href={basePath === "calendar" ? "/leave?view=list" : "/leave?view=list"}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-2.5 text-[0.8125rem] font-semibold text-[#6B7280] shadow-sm calm-transition hover:bg-[#F9FAFB] hover:text-[#111827]"
              title="Switch to list view to filter"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16M6 12h12M9 18h6" strokeLinecap="round" />
              </svg>
              <svg className="h-3.5 w-3.5 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div
        key={animTick}
        className={`loa-cal-month-enter overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] shadow-[0_4px_24px_rgba(15,23,42,0.05),0_1px_3px_rgba(15,23,42,0.04)] ${loading ? "opacity-70" : ""}`}
      >
        <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="border-r border-[#E5E7EB] py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280] last:border-r-0"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {gridCells.map(({ date: day, inMonth }) => {
            const key = localDayKey(day);
            const isToday = key === todayKey;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
            const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);

            const entries = requests.filter((r) => {
              const rStart = new Date(r.startDate);
              const rEnd = new Date(r.endDate);
              return rStart <= dayEnd && rEnd >= dayStart;
            });

            const showSpanDot = entries.some((request) => {
              const rStart = new Date(request.startDate);
              const rEnd = new Date(request.endDate);
              const span = daysSpan(rStart, rEnd);
              if (span <= 1 || request.status === "DENIED") return false;
              return rStart <= dayEnd && rEnd >= dayStart;
            });

            const eventBlocks: CalendarBlock[] = entries.flatMap((request): CalendarBlock[] => {
              const rStart = new Date(request.startDate);
              const rEnd = new Date(request.endDate);
              const span = daysSpan(rStart, rEnd);
              const range = monthOverlapRange(rStart, rEnd, calStart, calEnd);
              if (!range) return [];
              const d = stripTime(day);
              if (d < range.os || d > range.oe) return [];

              if (d.getTime() > range.os.getTime()) {
                return [{ key: `${request.id}-cont`, type: "continuation" as const, request }];
              }

              const st = request.status;
              const vis = startCardVisuals(st);
              return [
                {
                  key: request.id,
                  type: "event" as const,
                  request,
                  ...vis,
                  title: calendarTitleForRequest(request, day, span),
                  showSpanDot: span > 1 && st !== "DENIED",
                },
              ];
            });

            const isSelected = selectedKey === key;

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedKey((prev) => (prev === key ? null : key))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedKey((prev) => (prev === key ? null : key));
                  }
                }}
                className={`group relative min-h-[118px] border-b border-r border-[#E5E7EB] p-1.5 last:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]/40 ${
                  inMonth
                    ? isWeekend
                      ? "bg-[#FAFAFA]"
                      : "bg-[var(--surface-container-lowest)]"
                    : "bg-[#F9FAFB]"
                } ${isSelected ? "ring-1 ring-inset ring-[#2563EB]" : ""}`}
              >
                <div className="mb-1 flex items-start justify-between gap-1">
                  <span
                    className={`text-[11px] font-bold tabular-nums ${
                      inMonth ? (isToday ? "text-[#2563EB]" : "text-[#111827]") : "text-[#D1D5DB]"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {showSpanDot ? (
                      <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[#111827]" title="Multi-day leave" />
                    ) : null}
                    {inMonth && day.getDay() !== 0 && day.getDay() !== 6 ? (
                      <Link
                        href={`/leave/request?date=${key}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-sm font-semibold leading-none text-[#9CA3AF] opacity-0 calm-transition hover:bg-[#F3F4F6] hover:text-[#111827] group-hover:opacity-100"
                        title={`Request leave for ${day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      >
                        +
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {eventBlocks.map((block) =>
                    block.type === "continuation" ? (
                      <div
                        key={block.key}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] font-medium leading-snug text-[#4B5563]"
                      >
                        {continuationLabel(block.request)}
                      </div>
                    ) : (
                      <Link
                        key={block.key}
                        href={requestHrefForId(block.request.id)}
                        onClick={(e) => e.stopPropagation()}
                        className={`block overflow-hidden rounded-lg border calm-transition hover:brightness-[0.99] ${block.cardBg} ${block.cardBorder}`}
                      >
                        <div className="flex min-h-[2.75rem] gap-0">
                          <div className={`w-1.5 shrink-0 self-stretch rounded-l-[6px] ${block.accentBar}`} />
                          <div className="min-w-0 flex-1 py-1.5 pl-2 pr-1.5">
                            <p className={`truncate text-[11px] font-bold leading-tight ${block.titleClass}`}>
                              {block.title}
                            </p>
                            <p className={`mt-0.5 truncate text-[10px] font-medium ${block.subClass}`}>
                              {block.request.requester?.fullName?.trim() || "Staff"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
