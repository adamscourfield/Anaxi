import Link from "next/link";
import {
  WEEKDAYS,
  stripTime,
  daysSpan,
  monthOverlapRange,
  localDayKey,
  calendarTitleForRequest,
  continuationLabel,
} from "./leave-calendar-helpers";

type CalendarContinuationBlock = { key: string; type: "continuation"; request: any };
type CalendarEventBlock = {
  key: string;
  type: "event";
  request: any;
  bar: string;
  wrap: string;
  titleC: string;
  subC: string;
  title: string;
  showSpanDot: boolean;
};
type CalendarBlock = CalendarContinuationBlock | CalendarEventBlock;

type Props = {
  monthAnchor: Date;
  /** Requests that overlap the visible month */
  calendarRequests: any[];
  prevMonthHref: string;
  nextMonthHref: string;
  /** Detail page URL for a leave request */
  requestHrefForId: (id: string) => string;
};

export function LeaveCalendarGrid({
  monthAnchor,
  calendarRequests,
  prevMonthHref,
  nextMonthHref,
  requestHrefForId,
}: Props) {
  const calStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const calEnd = new Date(
    monthAnchor.getFullYear(),
    monthAnchor.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  const daysInMonth = calEnd.getDate();
  const calDays = Array.from(
    { length: daysInMonth },
    (_, i) => new Date(calStart.getFullYear(), calStart.getMonth(), i + 1),
  );
  const firstDayOfWeek = calStart.getDay();
  const todayKey = localDayKey(new Date());
  const monthLabel = calStart.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold capitalize tracking-tight text-text">{monthLabel}</h2>
          <div className="flex items-center gap-0.5">
            <Link
              href={prevMonthHref}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[var(--surface-container)] hover:text-text"
              aria-label="Previous month"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href={nextMonthHref}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[var(--surface-container)] hover:text-text"
              aria-label="Next month"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--outline)]" />
            Pending
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--status-approved)]" />
            Approved
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--status-denied)]" />
            Declined
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-background shadow-ambient">
        <div className="grid grid-cols-7 border-b border-border/50 bg-surface-container-low">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="border-r border-border/50 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.09em] text-muted last:border-r-0"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="min-h-[112px] border-b border-r border-border/30 bg-surface-container-low last:border-r-0"
            />
          ))}

          {calDays.map((day) => {
            const key = localDayKey(day);
            const isToday = key === todayKey;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
            const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);

            const entries = calendarRequests.filter((r: any) => {
              const rStart = new Date(r.startDate);
              const rEnd = new Date(r.endDate);
              return rStart <= dayEnd && rEnd >= dayStart;
            });

            const eventBlocks: CalendarBlock[] = entries.flatMap((request: any): CalendarBlock[] => {
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

              const st = request.status as string;
              const bar =
                st === "APPROVED"
                  ? "bg-[var(--status-approved)]"
                  : st === "DENIED"
                    ? "bg-[var(--status-denied)]"
                    : "bg-[var(--outline)]";
              const wrap =
                st === "APPROVED"
                  ? "bg-[var(--status-approved-bg)] border-[var(--status-approved-border)]"
                  : st === "DENIED"
                    ? "bg-[var(--status-denied-bg)] border-[var(--status-denied-border)]"
                    : "bg-surface-container-low border-border/50";
              const titleC =
                st === "APPROVED"
                  ? "text-[var(--status-approved-text)]"
                  : st === "DENIED"
                    ? "text-[var(--status-denied-text)]"
                    : "text-text";
              const subC =
                st === "APPROVED"
                  ? "text-[var(--status-approved-text)]"
                  : st === "DENIED"
                    ? "text-[var(--status-denied-text)]"
                    : "text-muted";

              return [
                {
                  key: request.id,
                  type: "event" as const,
                  request,
                  bar,
                  wrap,
                  titleC,
                  subC,
                  title: calendarTitleForRequest(request, day, span),
                  showSpanDot: span > 1 && st !== "DENIED",
                },
              ];
            });

            return (
              <div
                key={key}
                className={`group relative min-h-[112px] border-b border-r border-border/30 p-1.5 last:border-r-0 ${
                  isWeekend ? "bg-surface-container-low" : "bg-background"
                } ${isToday ? "ring-1 ring-inset ring-[var(--primary-container)]/15" : ""}`}
              >
                <div className="mb-1 flex items-start justify-between gap-1">
                  <span
                    className={`text-2xs font-bold tabular-nums ${
                      isToday ? "text-[var(--primary-container)]" : isWeekend ? "text-[var(--outline-variant)]" : "text-text"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {eventBlocks.some((b) => b.type === "event" && b.showSpanDot) && (
                      <span
                        className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-text"
                        title="Multi-day leave"
                      />
                    )}
                    {!isWeekend && (
                      <Link
                        href={`/leave/request?date=${key}`}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-sm font-semibold leading-none text-muted opacity-0 calm-transition hover:bg-[var(--surface-container)] hover:text-text group-hover:opacity-100"
                        title={`Request leave for ${day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      >
                        +
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {eventBlocks.map((block) =>
                    block.type === "continuation" ? (
                      <div
                        key={block.key}
                        className="rounded-lg bg-surface-container-low px-1.5 py-1 text-[9px] font-medium leading-tight text-muted/60"
                      >
                        {continuationLabel(block.request)}
                      </div>
                    ) : (
                      <Link
                        key={block.key}
                        href={requestHrefForId(block.request.id)}
                        className={`block overflow-hidden rounded-lg border calm-transition hover:brightness-[0.98] ${block.wrap}`}
                      >
                        <div className="flex gap-0">
                          <div className={`w-1 shrink-0 self-stretch rounded-l-[7px] ${block.bar}`} />
                          <div className="min-w-0 flex-1 py-1.5 pl-2 pr-1.5">
                            <p className={`truncate text-[10px] font-bold leading-tight ${block.titleC}`}>
                              {block.title}
                            </p>
                            <p className={`mt-0.5 truncate text-[9px] font-medium ${block.subC}`}>
                              {block.request.requester?.fullName ?? "Staff"}
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

          {Array.from({ length: (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, i) => (
            <div
              key={`trail-${i}`}
              className="min-h-[112px] border-b border-r border-border/30 bg-surface-container-low last:border-r-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
