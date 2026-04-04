"use client";

import Link from "next/link";

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
        <h2 className="text-[1.0625rem] font-semibold tracking-tight text-text">{title}</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-surface-container-low px-3.5 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:border-black/[0.1] hover:text-text"
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

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface-container-lowest shadow-ambient">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-container-low">
                {isManager && (
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                    Staff member
                  </th>
                )}
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  Requested dates
                </th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  Reason
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
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
                    className="border-t border-border/30 calm-transition hover:bg-surface-container-low"
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
                      <p className="font-medium text-text">{row.dateRangeLine}</p>
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
                          className="inline-flex rounded-xl border border-border/60 bg-surface-container-low px-4 py-2 text-[0.8125rem] font-semibold text-text calm-transition hover:border-border hover:bg-surface-container-high"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actionLabel}
                        </Link>
                      ) : row.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#166534]">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffe4e6] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9f1239]">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                          </svg>
                          Denied
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {mode === "completed" && rows.length > 0 && (
          <div className="border-t border-border/30 py-4 text-center">
            <Link
              href="/leave/history"
              className="text-[0.875rem] font-medium text-muted underline-offset-4 calm-transition hover:text-text hover:underline"
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
