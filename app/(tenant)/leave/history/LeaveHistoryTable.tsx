"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#166534]">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Approved
      </span>
    );
  }

  if (status === "DENIED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffe4e6] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9f1239]">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
        Denied
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#92400e]">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      Pending
    </span>
  );
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
        <h2 className="text-[1.0625rem] font-semibold tracking-tight text-text">Full Leave Ledger History</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/leave"
            className="inline-flex items-center rounded-xl border border-black/[0.08] bg-[#F1F3F5] px-3.5 py-2 text-[0.8125rem] font-medium text-text calm-transition hover:border-black/[0.12] hover:bg-[#e8eaed]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by staff name, reason, or date"
            className="h-10 rounded-xl border border-black/[0.08] px-3 text-sm text-text outline-none calm-transition focus:border-black/[0.15]"
          />
        </label>

        <label className="flex min-w-[11rem] flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | HistoryRow["status"])}
            className="h-10 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-text outline-none calm-transition focus:border-black/[0.15]"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F1F3F5]">
                {isManager && (
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Staff member</th>
                )}
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Requested dates</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Reason</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 4 : 3} className="px-5 py-10 text-center text-[0.875rem] text-muted">
                    No leave requests match your filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-[#eceef0] calm-transition hover:bg-[#fafbfc]">
                    {isManager && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${row.requesterAvatarColor}`}
                          >
                            {row.requesterInitials}
                          </div>
                          <span className="font-semibold text-text">{row.requesterName}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 text-text">
                      <p className="font-medium text-text">{row.requestedDates}</p>
                      <p className="mt-0.5 text-[0.8125rem] text-muted">{row.daysLabel}</p>
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
