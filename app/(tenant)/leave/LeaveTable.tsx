"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { loaStatusLabel } from "@/lib/leaveStatus";
import type { LeaveRow } from "@/modules/leave/leaveRow";
import type { LoaStatusUiBucket } from "@/lib/leaveStatus";

export type { LeaveRow };

type CompletedFilter = "ALL" | LoaStatusUiBucket;

function statusPill(row: LeaveRow) {
  if (row.status === "APPROVED") {
    return <StatusPill variant="success">{loaStatusLabel(row.statusRaw)}</StatusPill>;
  }
  if (row.status === "DENIED") {
    return <StatusPill variant="error">Denied</StatusPill>;
  }
  if (row.status === "CANCELLED") {
    return <StatusPill variant="neutral">Cancelled</StatusPill>;
  }
  return <StatusPill variant="warning">Pending</StatusPill>;
}

function PendingTable({
  rows,
  isManager,
  actionLabel,
}: {
  rows: LeaveRow[];
  isManager: boolean;
  actionLabel: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold tracking-[-0.02em] text-text">Pending requests</h2>

      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head-row text-left">
                {isManager && (
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Staff member
                  </th>
                )}
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Requested dates
                </th>
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Reason
                </th>
                <th className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={isManager ? 4 : 3}
                    className="px-5 py-10 text-center text-[0.875rem] text-muted"
                  >
                    No pending requests.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="table-row calm-transition">
                    {isManager && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {row.requesterAvatarColor && (
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${row.requesterAvatarColor}`}
                            >
                              {row.requesterInitials}
                            </div>
                          )}
                          <span className="font-semibold text-text">{row.requesterName ?? "—"}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <p className="font-semibold text-text">{row.dateRangeLine}</p>
                      <p className="mt-0.5 text-[0.8125rem] text-muted">
                        {row.days} working day{row.days !== 1 ? "s" : ""}
                      </p>
                    </td>
                    <td className="max-w-[min(28rem,50vw)] px-5 py-4 text-text">
                      <span className="line-clamp-2">{row.reasonLabel ?? "—"}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/leave/${row.id}`}
                        className="inline-flex rounded-md border border-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)] bg-background px-5 py-2 text-sm font-semibold text-text shadow-sm calm-transition hover:border-text/20 hover:bg-[var(--surface-container-low)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actionLabel}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CompletedTable({
  rows,
  isManager,
}: {
  rows: LeaveRow[];
  isManager: boolean;
}) {
  const [filter, setFilter] = useState<CompletedFilter>("ALL");

  const filtered =
    filter === "ALL" ? rows : rows.filter((r) => r.status === filter);

  const filters: { label: string; value: CompletedFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "Approved", value: "APPROVED" },
    { label: "Denied", value: "DENIED" },
    { label: "Cancelled", value: "CANCELLED" },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-text">Completed requests</h2>
        <div className="segmented-toggle" role="group" aria-label="Filter completed requests">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`segmented-toggle-btn${filter === f.value ? " segmented-toggle-btn-active" : ""}`}
              aria-pressed={filter === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head-row text-left">
                {isManager && (
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Staff member
                  </th>
                )}
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Requested dates
                </th>
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Reason
                </th>
                <th className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isManager ? 4 : 3}
                    className="px-5 py-10 text-center text-[0.875rem] text-muted"
                  >
                    No {filter === "ALL" ? "completed" : filter.toLowerCase()} requests.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="table-row calm-transition">
                    {isManager && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {row.requesterAvatarColor && (
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${row.requesterAvatarColor}`}
                            >
                              {row.requesterInitials}
                            </div>
                          )}
                          <span className="font-semibold text-text">{row.requesterName ?? "—"}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <Link href={`/leave/${row.id}`} className="block">
                        <p className="font-semibold text-text">{row.dateRangeLine}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-muted">
                          {row.days} working day{row.days !== 1 ? "s" : ""}
                        </p>
                      </Link>
                    </td>
                    <td className="max-w-[min(28rem,50vw)] px-5 py-4 text-text">
                      <span className="line-clamp-2">{row.reasonLabel ?? "—"}</span>
                    </td>
                    <td className="px-5 py-4 text-right">{statusPill(row)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div className="border-t border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] py-4 text-center">
            <Link
              href="/leave/history"
              className="link-subtle text-[0.875rem] font-medium underline-offset-4 calm-transition text-muted hover:text-text"
            >
              View full ledger history
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export function LeaveTable({
  pendingRows,
  completedRows,
  isManager,
}: {
  pendingRows: LeaveRow[];
  completedRows: LeaveRow[];
  isManager: boolean;
}) {
  const actionLabel = isManager ? "Review" : "View";
  return (
    <div className="space-y-10">
      <div id="pending-requests">
        <PendingTable rows={pendingRows} isManager={isManager} actionLabel={actionLabel} />
      </div>
      <div id="completed-requests">
        <CompletedTable rows={completedRows} isManager={isManager} />
      </div>
    </div>
  );
}
