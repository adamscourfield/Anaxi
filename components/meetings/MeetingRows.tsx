"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/ui/status-pill";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import { formatMeetingDay, formatMeetingTime } from "@/modules/meetings/format";
import { meetingState } from "./meetingStatus";
import styles from "./meetings.module.css";

export type MeetingRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  startDateTime: string;
  endDateTime: string;
  startedAt: string | null;
  endedAt: string | null;
  location: string | null;
  createdBy: { id: string; fullName: string };
  _count: { actions: number; attendees: number };
};

/** A list of meetings as rows; each row opens the meeting. */
export function MeetingRows({
  meetings,
  from,
  variant,
  todayStart,
  pageSize,
  total,
}: {
  meetings: MeetingRow[];
  from: string;
  variant: "upcoming" | "past" | "live";
  todayStart: string;
  /** Show this many, then "Show more" (past meetings). */
  pageSize?: number;
  /** All past meetings, including any not loaded. */
  total?: number;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(pageSize ?? meetings.length);
  const visible = meetings.slice(0, shown);
  const today = new Date(todayStart);

  return (
    <div className="space-y-3">
      <ul className={styles.list}>
        {visible.map((m) => {
          const href = `/meetings/${m.id}?from=${from}`;
          const state = meetingState(m, variant === "past" ? today : undefined);
          return (
            <li key={m.id} className={styles.row} onClick={() => router.push(href)} data-live={variant === "live" || undefined}>
              <div className={styles.when}>
                <span className="block text-[13px] font-semibold text-[#1c1c1e]">{formatMeetingDay(m.startedAt ?? m.startDateTime)}</span>
                <span className="block text-[12px] tabular-nums text-[#6e6e73]">
                  {formatMeetingTime(m.startedAt ?? m.startDateTime)}
                  {variant !== "past" ? `–${formatMeetingTime(m.endDateTime)}` : ""}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={href} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-[#1c1c1e] hover:underline">
                  {m.title}
                </Link>
                <span className="block truncate text-[12px] text-[#6e6e73]">
                  {[MEETING_TYPE_LABELS[m.type] ?? m.type, m.location, `${m._count.attendees} ${m._count.attendees === 1 ? "person" : "people"}`, `organised by ${m.createdBy.fullName}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {variant === "past" ? (
                <span className="hidden shrink-0 text-[13px] tabular-nums text-[#3a3a3c] sm:block">
                  {m._count.actions} {m._count.actions === 1 ? "action" : "actions"}
                </span>
              ) : null}
              <span className="hidden shrink-0 sm:block">
                <StatusPill variant={state.variant} size="sm">
                  {state.label}
                </StatusPill>
              </span>
              {variant === "past" && m.endedAt ? (
                <a
                  href={`/api/meetings/${m.id}/download`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className={styles.iconButton}
                  aria-label={`Download minutes for ${m.title}`}
                  title="Download minutes"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ) : variant === "past" ? (
                <span className="w-9 shrink-0" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ul>
      {pageSize && shown < meetings.length ? (
        <button type="button" className="text-[13px] font-medium text-[#1c1c1e] underline-offset-4 hover:underline" onClick={() => setShown((n) => n + pageSize)}>
          Show more past meetings
        </button>
      ) : total && total > meetings.length && shown >= meetings.length ? (
        <p className="text-[12px] text-[#6e6e73]">Showing the latest {meetings.length} of {total} past meetings.</p>
      ) : null}
    </div>
  );
}
