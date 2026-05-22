"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill, PillVariant } from "@/components/ui/status-pill";
import { MetaText } from "@/components/ui/typography";

interface ImportJob {
  id: string;
  type: string;
  status: string;
  fileName: string | null;
  rowCount: number;
  rowsProcessed: number;
  rowsFailed: number;
  errorSummary: string | null;
  createdAt: string;
}

function statusLabel(status: string): { text: string; variant: PillVariant } {
  switch (status) {
    case "COMPLETED":
    case "SUCCESS":
      return { text: "SUCCESS", variant: "success" };
    case "FAILED":
      return { text: "FAILED", variant: "error" };
    case "RUNNING":
    case "PROCESSING":
      return { text: "PARTIAL", variant: "warning" };
    default:
      return { text: status, variant: "neutral" };
  }
}

function fileIcon(status: string) {
  if (status === "FAILED") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--pill-error-bg)] text-[var(--pill-error-text)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }) + " " + d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase();
}

const PAGE_SIZE = 4;

export function SnapshotImportHistory({
  jobs: initialJobs,
  total: initialTotal,
}: {
  jobs: ImportJob[];
  total: number;
}) {
  const [jobs] = useState<ImportJob[]>(initialJobs);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(initialTotal / PAGE_SIZE));
  const visibleJobs = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingCount = Math.min(PAGE_SIZE, initialTotal - (page - 1) * PAGE_SIZE);

  return (
    <div className="table-shell">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-text">
          Recent Import History
        </h3>
        {/* API download endpoint; keep a native anchor for file navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/import/jobs?format=csv"
          className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-text calm-transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download All Logs
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="px-6 py-3 text-left">Filename</th>
              <th className="px-4 py-3 text-left">Date &amp; Time</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Rows</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted">
                  No import jobs yet.
                </td>
              </tr>
            ) : (
              visibleJobs.map((job) => {
                const { text, variant } = statusLabel(job.status);
                return (
                  <tr key={job.id} className="table-row calm-transition">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {fileIcon(job.status)}
                        <span className="text-sm font-medium text-text">
                          {job.fileName ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusPill variant={variant} size="sm">
                        {text}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-text tabular-nums">
                      {(job.rowsProcessed || job.rowCount).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        href={`/behaviour/import/job/${job.id}`}
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          job.status === "FAILED"
                            ? "text-error hover:text-error/80"
                            : "text-muted hover:text-text"
                        } calm-transition`}
                      >
                        View Log
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3">
        <MetaText>
          Showing last {showingCount} {showingCount === 1 ? "entry" : "entries"}
        </MetaText>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[var(--surface-container-low)] disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[var(--surface-container-low)] disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
