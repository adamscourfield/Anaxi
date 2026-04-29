"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";

export type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  dateRangeLine: string;
  days: number;
  status: "PENDING" | "APPROVED" | "DENIED";
  reasonLabel: string | null;
  requesterName: string | null;
  requesterInitials: string | null;
  requesterAvatarColor: string | null;
};

function SectionTable({
  title,
  filterLabel,
  rows,
  isManager,
  mode,
  actionLabel,
}: {
  title: string;
  filterLabel: string;
  rows: LeaveRow[];
  isManager: boolean;
  mode: "pending" | "completed";
  actionLabel: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-text">{title}</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--outline-variant)_38%,transparent)] bg-[var(--surface-container-lowest)] px-4 py-2 text-[0.8125rem] font-semibold text-muted shadow-sm calm-transition hover:border-text/15 hover:text-text"
        >
          <svg
            className="h-3.5 w-3.5 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {filterLabel}
        </button>
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
                  {mode === "pending" ? "Actions" : "Status"}
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
                    No {mode === "pending" ? "pending" : "completed"} requests.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="table-row calm-transition"
                  >
                    {isManager && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {row.requesterAvatarColor && (
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${row.requesterAvatarColor}`}
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
                      {mode === "pending" ? (
                        <Link
                          href={`/leave/${row.id}`}
                          className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)] bg-[var(--surface-container-lowest)] px-5 py-2 text-sm font-semibold text-text shadow-sm calm-transition hover:border-text/20 hover:bg-[var(--surface-container-low)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actionLabel}
                        </Link>
                      ) : row.status === "APPROVED" ? (
                        <StatusPill variant="success">Approved</StatusPill>
                      ) : (
                        <StatusPill variant="error">Denied</StatusPill>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {mode === "completed" && rows.length > 0 && (
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
        <SectionTable
          title="Pending requests"
          filterLabel="Filter: Pending"
          rows={pendingRows}
          isManager={isManager}
          mode="pending"
          actionLabel={actionLabel}
        />
      </div>
      <div id="completed-requests">
        <SectionTable
          title="Completed requests"
          filterLabel="Filter: All history"
          rows={completedRows}
          isManager={isManager}
          mode="completed"
          actionLabel={actionLabel}
        />
      </div>
    </div>
  );
}
