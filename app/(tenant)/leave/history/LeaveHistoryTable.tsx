"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";

type HistoryRow = {
  id: string;
  requesterName: string;
  requesterInitials: string;
  requesterAvatarColor: string;
  requestedDates: string;
  daysLabel: string;
  reasonLabel: string;
  status: "PENDING" | "APPROVED" | "DENIED";
};

function statusBadge(status: HistoryRow["status"]) {
  if (status === "APPROVED") return <StatusPill variant="success">Approved</StatusPill>;
  if (status === "DENIED") return <StatusPill variant="error">Denied</StatusPill>;
  return <StatusPill variant="warning">Pending</StatusPill>;
}

export function LeaveHistoryTable({ rows, isManager }: { rows: HistoryRow[]; isManager: boolean }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | HistoryRow["status"]>("ALL");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
      const haystack = `${row.requesterName} ${row.reasonLabel} ${row.requestedDates}`.toLowerCase();
      const matchesQuery = query.trim().length === 0 || haystack.includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }, [query, rows, statusFilter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-text">Full Leave Ledger History</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/leave"
            className="inline-flex items-center rounded-md border border-border/60 bg-surface-container-low px-3.5 py-2 text-sm font-medium text-text calm-transition hover:border-border hover:bg-surface-container-high"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="filter-panel flex flex-wrap gap-4">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <span className="filter-field-label">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by staff name, reason, or date"
            className="field field-filter-trigger !py-2.5 !text-sm"
          />
        </label>

        <label className="flex min-w-[11rem] flex-col gap-1.5">
          <span className="filter-field-label">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | HistoryRow["status"])}
            className="field field-filter-trigger !py-2.5 !text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </label>
      </div>

      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head-row text-left">
                {isManager && (
                  <th className="px-5 py-3.5">Staff member</th>
                )}
                <th className="px-5 py-3.5">Requested dates</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 4 : 3} className="px-5 py-10 text-center text-sm text-muted">
                    No leave requests match your filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="table-row calm-transition">
                    {isManager && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-2xs font-semibold ${row.requesterAvatarColor}`}
                          >
                            {row.requesterInitials}
                          </div>
                          <span className="font-semibold text-text">{row.requesterName}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 text-text">
                      <p className="font-medium text-text">{row.requestedDates}</p>
                      <p className="mt-0.5 text-sm text-muted">{row.daysLabel}</p>
                    </td>
                    <td className="max-w-[min(28rem,50vw)] px-5 py-4 text-text">
                      <span className="line-clamp-2">{row.reasonLabel}</span>
                    </td>
                    <td className="px-5 py-4 text-right">{statusBadge(row.status)}</td>
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
