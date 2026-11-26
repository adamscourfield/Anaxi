"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { loaStatusLabel } from "@/lib/leaveStatus";
import type { LoaStatusUiBucket } from "@/lib/leaveStatus";
import type { LeaveRow } from "@/modules/leave/leaveRow";
import styles from "./page.module.css";

export type { LeaveRow };

type DecidedFilter = "ALL" | Exclude<LoaStatusUiBucket, "PENDING">;

function statusPill(row: LeaveRow) {
  if (row.status === "APPROVED") return <StatusPill variant="success">{loaStatusLabel(row.statusRaw)}</StatusPill>;
  if (row.status === "DENIED") return <StatusPill variant="error">Denied</StatusPill>;
  if (row.status === "CANCELLED") return <StatusPill variant="neutral">Cancelled</StatusPill>;
  return <StatusPill variant="warning">Waiting</StatusPill>;
}

function Who({ row, viewerId }: { row: LeaveRow; viewerId: string }) {
  const own = row.requesterUserId === viewerId;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="hidden shrink-0 sm:inline-flex">
        <Avatar name={row.requesterName ?? "?"} userId={row.requesterUserId} size="sm" />
      </span>
      <span className="truncate font-medium">{own ? "You" : row.requesterName ?? "Unknown"}</span>
    </span>
  );
}

function When({ row }: { row: LeaveRow }) {
  return (
    <span className="min-w-0">
      <span className="block font-medium">{row.dateRangeLine}</span>
      <span className="block text-[12px] text-[#6e6e73]">
        {row.days} working day{row.days !== 1 ? "s" : ""}
        <span className="sm:hidden">, {row.reasonLabel ?? "Leave"}</span>
      </span>
    </span>
  );
}

export function LeaveTable({
  pendingRows,
  completedRows,
  isManager,
  viewerId,
}: {
  pendingRows: LeaveRow[];
  completedRows: LeaveRow[];
  isManager: boolean;
  viewerId: string;
}) {
  const [filter, setFilter] = useState<DecidedFilter>("ALL");
  const decided = filter === "ALL" ? completedRows : completedRows.filter((r) => r.status === filter);
  const toReview = pendingRows.filter((r) => r.requesterUserId !== viewerId).length;

  const filters: { label: string; value: DecidedFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "Approved", value: "APPROVED" },
    { label: "Denied", value: "DENIED" },
    { label: "Cancelled", value: "CANCELLED" },
  ];

  return (
    <div className="space-y-10">
      <section id="pending-requests" aria-labelledby="leave-pending">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="leave-pending" className="text-[17px] font-semibold tracking-[-0.02em]">
            Waiting for a decision
          </h2>
          {isManager && toReview ? (
            <span className="text-[13px] text-[#6e6e73]">
              {toReview} for you to review
            </span>
          ) : null}
        </div>
        {pendingRows.length === 0 ? (
          <p className={styles.empty}>Nothing waiting.</p>
        ) : (
          <ul className={styles.list}>
            {pendingRows.map((row) => {
              const canReview = isManager && row.requesterUserId !== viewerId;
              return (
                <li key={row.id}>
                  <Link href={`/leave/${row.id}`} className={styles.row}>
                    {isManager ? (
                      <span className={styles.who}>
                        <Who row={row} viewerId={viewerId} />
                      </span>
                    ) : null}
                    <span className={styles.when}>
                      <When row={row} />
                    </span>
                    <span className={styles.type}>{row.reasonLabel ?? "Leave"}</span>
                    <span className={styles.end}>
                      {canReview ? <span className={styles.review}>Review</span> : statusPill(row)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="completed-requests" aria-labelledby="leave-decided">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="leave-decided" className="text-[17px] font-semibold tracking-[-0.02em]">
            Decided
          </h2>
          {completedRows.length ? (
            <div className={styles.segmented} role="group" aria-label="Show">
              {filters.map((f) => (
                <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {decided.length === 0 ? (
          <p className={styles.empty}>
            {completedRows.length === 0 ? "No decisions yet." : `Nothing ${filters.find((f) => f.value === filter)?.label.toLowerCase()}.`}
          </p>
        ) : (
          <ul className={styles.list}>
            {decided.map((row) => (
              <li key={row.id}>
                <Link href={`/leave/${row.id}`} className={styles.row}>
                  {isManager ? (
                    <span className={styles.who}>
                      <Who row={row} viewerId={viewerId} />
                    </span>
                  ) : null}
                  <span className={styles.when}>
                    <When row={row} />
                  </span>
                  <span className={styles.type}>{row.reasonLabel ?? "Leave"}</span>
                  <span className={styles.end}>{statusPill(row)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {completedRows.length > 0 ? (
          <p className="mt-3 px-1 text-[13px]">
            <Link href="/leave/history" className="font-medium text-[#3a3a3c] underline-offset-4 hover:text-[#1c1c1e] hover:underline">
              See every request
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
