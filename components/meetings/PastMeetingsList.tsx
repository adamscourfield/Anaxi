"use client";

import { useState } from "react";
import Link from "next/link";

interface PastMeeting {
  id: string;
  title: string;
  startDateTime: string | Date;
  createdBy: { fullName: string };
  _count?: { actions: number };
}

const INITIAL_DISPLAY = 5;
const LOAD_MORE_COUNT = 5;

function formatMonth(date: Date): string {
  return date.toLocaleString("en-US", { month: "short" }).toUpperCase();
}

function formatDay(date: Date): string {
  return String(date.getDate());
}

export function PastMeetingsList({ meetings }: { meetings: PastMeeting[] }) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);

  const visible = meetings.slice(0, displayCount);
  const hasMore = displayCount < meetings.length;

  if (meetings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center">
        <p className="text-sm font-medium text-text">No past meetings</p>
        <p className="mt-1 text-xs text-muted">Completed meetings will appear here for easy reference.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((m) => {
        const date = new Date(m.startDateTime);
        const actionCount = m._count?.actions ?? 0;
        return (
          <div
            key={m.id}
            className="explorer-kpi-tile flex items-center gap-4 rounded-2xl px-5 py-4"
          >
            {/* Date badge */}
            <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[var(--surface-container-lowest)] shadow-sm">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                {formatMonth(date)}
              </span>
              <span className="text-lg font-bold leading-tight tracking-[-0.02em] text-text">
                {formatDay(date)}
              </span>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-text">{m.title}</p>
              <p className="text-xs text-muted">Minutes recorded by: {m.createdBy.fullName}</p>
            </div>

            {/* Action count */}
            <div className="flex-shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Action count</p>
              <p className="text-sm font-bold text-text">{actionCount} item{actionCount !== 1 ? "s" : ""}</p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-shrink-0 gap-2">
              <Link
                href={`/meetings/${m.id}`}
                className="calm-transition flex h-9 w-9 items-center justify-center rounded-md border border-border/40 bg-surface text-muted hover:bg-divider/60 hover:text-text"
                title="View meeting"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                  <path
                    fillRule="evenodd"
                    d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <a
                href={`/api/meetings/${m.id}/download`}
                className="calm-transition flex h-9 w-9 items-center justify-center rounded-md border border-border/40 bg-surface text-muted hover:bg-divider/60 hover:text-text"
                title="Download minutes"
                download
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
              </a>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={() => setDisplayCount((prev) => prev + LOAD_MORE_COUNT)}
          className="calm-transition mx-auto flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted hover:text-text"
        >
          Load more entries
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
