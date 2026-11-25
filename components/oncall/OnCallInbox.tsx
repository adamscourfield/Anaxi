"use client";

import { type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RESOLVED_HISTORY_RANGE_LABELS, type ResolvedHistoryRange } from "@/modules/oncall/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  LiveIndicator,
  TypeTag,
  formatDuration,
  formatWhen,
  formatYearGroup,
  since,
  useLiveRefresh,
  useOnCallAction,
  type OnCallStatus,
  type OnCallType,
} from "./shared";
import { OnCallFilters } from "./OnCallFilters";
import styles from "./OnCallInbox.module.css";

export interface InboxRequest {
  id: string;
  requestType: OnCallType;
  isEmergency?: boolean;
  location: string;
  reason?: string | null;
  status: OnCallStatus;
  createdAt: Date | string;
  acknowledgedAt?: Date | string | null;
  /** Only sent to staff allowed to see resolve times. */
  resolvedAt?: Date | string | null;
  requester: { fullName: string };
  student: { fullName: string; yearGroup?: string | null; avatarUrl?: string | null };
  responder?: { fullName: string } | null;
}

export interface OnCallStats {
  waiting: number;
  oldestWaitingAt: Date | string | null;
  acknowledged: number;
  raisedToday: number;
  resolvedToday: number;
  /** Null when there's nothing to average yet, or the viewer can't see response times. */
  avgTimeToAcknowledgeMs: number | null;
}

interface OnCallInboxProps {
  openRequests: InboxRequest[];
  resolvedRequests: InboxRequest[];
  resolvedRange: ResolvedHistoryRange;
  canAcknowledge?: boolean;
  canResolve?: boolean;
  /** SLT/Admin/Super Admin only -- everyone else sees that a request is resolved, not when or how fast. */
  canViewResolveTime?: boolean;
  /** False for staff who only see the requests they raised. */
  canViewAll?: boolean;
  /** Whole-school headline numbers; null for staff who only see their own requests. */
  stats: OnCallStats | null;
  filtersActive: boolean;
  /** Year group / reason filters shown above the lists. */
  filters: ComponentProps<typeof OnCallFilters>;
}

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73]";

export function OnCallInbox({
  openRequests,
  resolvedRequests,
  resolvedRange,
  canAcknowledge,
  canResolve,
  canViewResolveTime,
  canViewAll = true,
  stats,
  filtersActive,
  filters,
}: OnCallInboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = useOnCallAction();
  const { updatedAt, now } = useLiveRefresh(action.anyPending);

  // Emergencies first, then whoever has waited longest.
  const waiting = openRequests
    .filter((r) => r.status === "OPEN")
    .sort(
      (a, b) =>
        Number(Boolean(b.isEmergency)) - Number(Boolean(a.isEmergency)) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const acknowledged = openRequests
    .filter((r) => r.status === "ACKNOWLEDGED")
    .sort(
      (a, b) =>
        new Date(a.acknowledgedAt ?? a.createdAt).getTime() - new Date(b.acknowledgedAt ?? b.createdAt).getTime(),
    );

  /** Preserve the inbox's current filter state so "Back" returns to the same view. */
  function detailHref(requestId: string): string {
    const qs = searchParams.toString();
    const from = encodeURIComponent(qs ? `${pathname}?${qs}` : pathname);
    return `/on-call/${requestId}?from=${from}`;
  }

  function handleRangeChange(next: ResolvedHistoryRange) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "today") params.delete("range");
    else params.set("range", next);
    const qs = params.toString();
    router.replace(qs ? `/on-call?${qs}` : "/on-call", { scroll: false });
  }

  const rowProps = (id: string) => ({
    onClick: () => router.push(detailHref(id)),
    className: `${styles.row} cursor-pointer`,
  });

  const actionButton = (r: InboxRequest, kind: "acknowledge" | "resolve") => (
    <Button
      type="button"
      variant="secondary"
      className="h-9 min-h-0 px-4 text-[13px]"
      disabled={action.isPending(r.id)}
      onClick={(e) => {
        e.stopPropagation();
        void action.run(r.id, kind);
      }}
    >
      {action.isPending(r.id, kind) ? "Saving…" : kind === "acknowledge" ? "Acknowledge" : "Resolve"}
    </Button>
  );

  const studentCell = (r: InboxRequest) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={r.student.fullName} avatarUrl={r.student.avatarUrl} size="md" tone="muted" />
      <span className="min-w-0">
        <Link
          href={detailHref(r.id)}
          onClick={(e) => e.stopPropagation()}
          className="block truncate font-semibold text-[#1c1c1e] hover:underline"
        >
          {r.student.fullName}
        </Link>
        <span className="block text-[12px] text-[#6e6e73]">{formatYearGroup(r.student.yearGroup)}</span>
      </span>
    </div>
  );

  const typeCell = (r: InboxRequest) => (
    <div className="space-y-0.5">
      <TypeTag type={r.requestType} emergency={r.isEmergency} />
      {r.reason ? <p className="text-[12px] text-[#6e6e73]">{r.reason}</p> : null}
    </div>
  );

  return (
    <div className="w-full min-w-0 space-y-10">
      {stats ? <StatsStrip stats={stats} now={now} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OnCallFilters {...filters} />
        <div className="flex items-center gap-4">
          <LiveIndicator updatedAt={updatedAt} now={now} />
          <Link href="/on-call/feed" className="text-[13px] font-medium text-[#1c1c1e] underline-offset-4 hover:underline">
            Today&rsquo;s log
          </Link>
        </div>
      </div>

      {/* ── Waiting ─────────────────────────────────────────────────── */}
      <section aria-labelledby="oncall-waiting">
        <SectionHeading
          id="oncall-waiting"
          title={canViewAll ? "Waiting for someone" : "Waiting for a response"}
          count={waiting.length}
          hint={waiting.length ? "Emergencies first, then longest wait." : undefined}
        />
        {waiting.length === 0 ? (
          <EmptyState
            mode="embedded"
            title={filtersActive ? "Nothing waiting that matches these filters" : "Nobody is waiting"}
            description={
              filtersActive
                ? "Other year groups or reasons may still have call-outs waiting. Clear the filters to see everything."
                : "New call-outs appear here the moment they're raised."
            }
          />
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {waiting.map((r) => (
                <MobileCard key={r.id} r={r} href={detailHref(r.id)} emergency={r.isEmergency}>
                  <p className="text-[13px] text-[#1c1c1e]">
                    Waiting <strong className="font-semibold tabular-nums">{since(r.createdAt, now)}</strong> · {r.location}
                  </p>
                  {canViewAll ? <p className="text-[12px] text-[#6e6e73]">Raised by {r.requester.fullName}</p> : null}
                  {canAcknowledge ? <div className="pt-1">{actionButton(r, "acknowledge")}</div> : null}
                </MobileCard>
              ))}
            </ul>
            <div className={`${styles.tableCard} hidden md:block`}>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className={styles.headRow}>
                    <th className={`${TH} pl-5`}>Student</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Location</th>
                    {canViewAll ? <th className={TH}>Raised by</th> : null}
                    <th className={TH}>Waiting</th>
                    {canAcknowledge ? <th className={`${TH} pr-5 text-right`}><span className="sr-only">Action</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((r) => (
                    <tr key={r.id} {...rowProps(r.id)} data-emergency={r.isEmergency || undefined}>
                      <td className="py-3.5 pl-5 pr-4">{studentCell(r)}</td>
                      <td className="px-4 py-3.5">{typeCell(r)}</td>
                      <td className="px-4 py-3.5 text-[#1c1c1e]">{r.location}</td>
                      {canViewAll ? <td className="px-4 py-3.5 text-[#3a3a3c]">{r.requester.fullName}</td> : null}
                      <td className="px-4 py-3.5">
                        <span className="block font-semibold tabular-nums text-[#1c1c1e]">{since(r.createdAt, now)}</span>
                        <span className="block text-[12px] tabular-nums text-[#6e6e73]">Raised {formatWhen(r.createdAt)}</span>
                      </td>
                      {canAcknowledge ? (
                        <td className="py-3.5 pl-4 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                          {actionButton(r, "acknowledge")}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── Acknowledged ────────────────────────────────────────────── */}
      {acknowledged.length > 0 ? (
        <section aria-labelledby="oncall-acknowledged">
          <SectionHeading id="oncall-acknowledged" title="Acknowledged" count={acknowledged.length} hint="Someone is on their way or dealing with it." />
          <ul className="space-y-2 md:hidden">
            {acknowledged.map((r) => (
              <MobileCard key={r.id} r={r} href={detailHref(r.id)} emergency={r.isEmergency}>
                <p className="text-[13px] text-[#1c1c1e]">
                  With <strong className="font-semibold">{r.responder?.fullName ?? "a colleague"}</strong> · {r.location}
                </p>
                <p className="text-[12px] text-[#6e6e73]">
                  Acknowledged {r.acknowledgedAt ? `${since(r.acknowledgedAt, now)} ago` : ""}
                </p>
                {canResolve ? <div className="pt-1">{actionButton(r, "resolve")}</div> : null}
              </MobileCard>
            ))}
          </ul>
          <div className={`${styles.tableCard} hidden md:block`}>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className={styles.headRow}>
                  <th className={`${TH} pl-5`}>Student</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Location</th>
                  <th className={TH}>With</th>
                  <th className={TH}>Acknowledged</th>
                  {canResolve ? <th className={`${TH} pr-5 text-right`}><span className="sr-only">Action</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {acknowledged.map((r) => (
                  <tr key={r.id} {...rowProps(r.id)} data-emergency={r.isEmergency || undefined}>
                    <td className="py-3.5 pl-5 pr-4">{studentCell(r)}</td>
                    <td className="px-4 py-3.5">{typeCell(r)}</td>
                    <td className="px-4 py-3.5 text-[#1c1c1e]">{r.location}</td>
                    <td className="px-4 py-3.5 text-[#1c1c1e]">{r.responder?.fullName ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      {r.acknowledgedAt ? (
                        <>
                          <span className="block tabular-nums text-[#1c1c1e]">{since(r.acknowledgedAt, now)} ago</span>
                          <span className="block text-[12px] tabular-nums text-[#6e6e73]">
                            after waiting {formatDuration(new Date(r.acknowledgedAt).getTime() - new Date(r.createdAt).getTime())}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    {canResolve ? (
                      <td className="py-3.5 pl-4 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                        {actionButton(r, "resolve")}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Resolved ────────────────────────────────────────────────── */}
      <section aria-labelledby="oncall-resolved">
        <SectionHeading
          id="oncall-resolved"
          title="Resolved"
          count={resolvedRequests.length}
          action={
            <label className="inline-flex items-center gap-2 text-[13px] text-[#6e6e73]">
              <span className="sr-only">Show resolved call-outs from</span>
              <select
                value={resolvedRange}
                onChange={(e) => handleRangeChange(e.target.value as ResolvedHistoryRange)}
                className={styles.select}
              >
                {(Object.keys(RESOLVED_HISTORY_RANGE_LABELS) as ResolvedHistoryRange[]).map((option) => (
                  <option key={option} value={option}>
                    {RESOLVED_HISTORY_RANGE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        {resolvedRequests.length === 0 ? (
          <EmptyState
            mode="embedded"
            title={resolvedRange === "all" ? "Nothing resolved yet" : `Nothing resolved ${RESOLVED_HISTORY_RANGE_LABELS[resolvedRange].toLowerCase()}`}
            description={resolvedRange === "all" ? "Resolved call-outs are kept here." : "Choose a longer period to see earlier call-outs."}
          />
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {resolvedRequests.map((r) => (
                <MobileCard key={r.id} r={r} href={detailHref(r.id)}>
                  <p className="text-[12px] text-[#6e6e73]">
                    Raised by {r.requester.fullName} · {formatWhen(r.createdAt)}
                    {r.responder ? ` · handled by ${r.responder.fullName}` : ""}
                  </p>
                  {canViewResolveTime && r.resolvedAt ? (
                    <p className="text-[12px] text-[#6e6e73]">
                      Resolved {formatWhen(r.resolvedAt)}, after {formatDuration(new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime())}
                    </p>
                  ) : null}
                </MobileCard>
              ))}
            </ul>
            <div className={`${styles.tableCard} hidden md:block`}>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className={styles.headRow}>
                    <th className={`${TH} pl-5`}>Student</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Raised</th>
                    <th className={TH}>Handled by</th>
                    {canViewResolveTime ? (
                      <>
                        <th className={TH}>Resolved</th>
                        <th className={`${TH} pr-5`}>Took</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {resolvedRequests.map((r) => (
                    <tr key={r.id} {...rowProps(r.id)}>
                      <td className="py-3.5 pl-5 pr-4">{studentCell(r)}</td>
                      <td className="px-4 py-3.5">{typeCell(r)}</td>
                      <td className="px-4 py-3.5">
                        <span className="block tabular-nums text-[#1c1c1e]">{formatWhen(r.createdAt)}</span>
                        <span className="block text-[12px] text-[#6e6e73]">by {r.requester.fullName}</span>
                      </td>
                      <td className="px-4 py-3.5 text-[#1c1c1e]">{r.responder?.fullName ?? "—"}</td>
                      {canViewResolveTime ? (
                        <>
                          <td className="px-4 py-3.5 tabular-nums text-[#1c1c1e]">{r.resolvedAt ? formatWhen(r.resolvedAt) : "—"}</td>
                          <td className="py-3.5 pl-4 pr-5 tabular-nums text-[#1c1c1e]">
                            {r.resolvedAt ? formatDuration(new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()) : "—"}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StatsStrip({ stats, now }: { stats: OnCallStats; now: number }) {
  const cells: { label: string; value: ReactNode; detail: string }[] = [
    {
      label: "Waiting now",
      value: stats.waiting,
      detail: stats.oldestWaitingAt ? `Longest wait ${since(stats.oldestWaitingAt, now)}` : "Nobody waiting",
    },
    {
      label: "Acknowledged",
      value: stats.acknowledged,
      detail: "Someone is dealing with it",
    },
    {
      label: "Raised today",
      value: stats.raisedToday,
      detail: `${stats.resolvedToday} resolved so far`,
    },
    {
      label: "Average time to acknowledge",
      value:
        stats.avgTimeToAcknowledgeMs === null
          ? "—"
          : stats.avgTimeToAcknowledgeMs < 60_000
            ? "<1 min"
            : formatDuration(stats.avgTimeToAcknowledgeMs),
      detail: stats.avgTimeToAcknowledgeMs === null ? "Nothing acknowledged yet today" : "Across today's call-outs",
    },
  ];
  return (
    <section aria-label="On call right now" className={styles.stats}>
      {cells.map((c) => (
        <div key={c.label} className={styles.stat} data-alert={c.label === "Waiting now" && stats.waiting > 0 ? "" : undefined}>
          <p className="text-[12px] font-medium text-[#6e6e73]">{c.label}</p>
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-[#1c1c1e] tabular-nums">{c.value}</p>
          <p className="mt-2 text-[12px] text-[#6e6e73]">{c.detail}</p>
        </div>
      ))}
    </section>
  );
}

function SectionHeading({
  id,
  title,
  count,
  hint,
  action,
}: {
  id: string;
  title: string;
  count: number;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em] text-[#1c1c1e]">
          {title}
          <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[#3a3a3c]">{count}</span>
        </h2>
        {hint ? <p className="mt-0.5 text-[13px] text-[#6e6e73]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

function MobileCard({
  r,
  href,
  emergency,
  children,
}: {
  r: InboxRequest;
  href: string;
  emergency?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <li
      className={styles.card}
      data-emergency={emergency || undefined}
      onClick={() => router.push(href)}
    >
      <div className="flex items-start gap-3">
        <Avatar name={r.student.fullName} avatarUrl={r.student.avatarUrl} size="md" tone="muted" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <Link href={href} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#1c1c1e]">
              {r.student.fullName}
            </Link>
            <span className="text-[12px] text-[#6e6e73]">{formatYearGroup(r.student.yearGroup)}</span>
          </div>
          <TypeTag type={r.requestType} emergency={r.isEmergency} />
          {children}
        </div>
      </div>
    </li>
  );
}
