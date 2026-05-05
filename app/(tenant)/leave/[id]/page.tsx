import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { decideLoaRequest } from "../actions";

const ACCENT = "#7C69EF";

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmtSubmitted(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function businessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const fin = new Date(end);
  fin.setHours(0, 0, 0, 0);
  while (cur <= fin) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function CalendarGlyph({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={muted ? "currentColor" : ACCENT}
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function ClockGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STATUS_STYLES: Record<string, { badge: string; iconWrap: string; icon: ReactNode; label: string }> = {
  PENDING: {
    badge: "border-[color-mix(in_srgb,#ea580c_35%,transparent)] bg-[color-mix(in_srgb,#ea580c_12%,transparent)] text-[#c2410c]",
    iconWrap: "text-[#ea580c]",
    label: "Pending approval",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
  APPROVED_WITH_PAY: {
    badge: "border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    iconWrap: "text-emerald-600",
    label: "Approved with pay",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  APPROVED_WITHOUT_PAY: {
    badge: "border-amber-300/90 bg-amber-50 text-amber-900 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100",
    iconWrap: "text-amber-600",
    label: "Approved without pay",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  APPROVED: {
    badge: "border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    iconWrap: "text-emerald-600",
    label: "Approved",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  DENIED: {
    badge: "border-red-300/80 bg-red-50 text-red-800 dark:border-red-600/50 dark:bg-red-950/40 dark:text-red-200",
    iconWrap: "text-red-600",
    label: "Denied",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
};

function InfoCell({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-3 p-4 sm:p-5 ${className ?? ""}`}>
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(124,105,239,0.12)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
        <p className="mt-1 text-[0.9375rem] font-bold leading-snug text-text">{value}</p>
      </div>
    </div>
  );
}

function NotesBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/35 bg-[color-mix(in_srgb,var(--surface-container-low)_55%,transparent)] px-4 py-4 sm:px-5">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(124,105,239,0.12)]">
          <DocGlyph className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">{title}</p>
          <div className="mt-1.5 text-[0.875rem] leading-relaxed text-text">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default async function LeaveDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");

  const request = await (prisma as any).lOARequest.findFirst({
    where: { id: params.id, tenantId: user.tenantId },
    include: { requester: true, reason: true },
  });
  if (!request) notFound();

  const manager = request.requesterId !== user.id && (await canManageLoa(user, request.requesterId));
  if (!manager && request.requesterId !== user.id) throw new Error("FORBIDDEN");

  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);
  const days = businessDays(startDate, endDate);
  const status = request.status as string;
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;

  const fromCalendar = searchParams?.from === "calendar";
  const calendarMonth = String(searchParams?.month || "");
  const calendarBackHref =
    fromCalendar && /^\d{4}-\d{2}$/.test(calendarMonth)
      ? `/leave/calendar?month=${calendarMonth}`
      : fromCalendar
        ? "/leave/calendar"
        : "/leave";

  const surfaceCard =
    "rounded-2xl border border-border/35 bg-surface-container-lowest shadow-[0_2px_20px_rgba(15,23,42,0.06)]";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8 pt-1">
      <Link
        href={calendarBackHref}
        className="inline-flex items-center gap-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {fromCalendar ? "Back to calendar" : "Back to requests"}
      </Link>

      {/* Request summary */}
      <div className={`${surfaceCard} overflow-hidden`}>
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">Leave request</p>
              <h1 className="mt-2 text-[1.5rem] font-bold leading-tight tracking-[-0.02em] text-text sm:text-[1.65rem]">
                {request.requester?.fullName ?? "Staff member"}
              </h1>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold ${statusStyle.badge}`}
            >
              <span className={statusStyle.iconWrap}>{statusStyle.icon}</span>
              {statusStyle.label}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/40 bg-[color-mix(in_srgb,var(--surface-container-low)_45%,transparent)]">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <InfoCell
                icon={<CalendarGlyph className="h-5 w-5" />}
                label="Start"
                value={fmt(startDate)}
                className="border-b border-border/25 sm:border-r sm:border-b-0"
              />
              <InfoCell
                icon={<CalendarGlyph className="h-5 w-5" />}
                label="End"
                value={fmt(endDate)}
                className="border-b border-border/25 sm:border-b-0"
              />
              <InfoCell
                icon={<ClockGlyph className="h-5 w-5" />}
                label="Duration"
                value={`${days} school day${days !== 1 ? "s" : ""}`}
                className="border-b border-border/25 sm:border-r sm:border-t sm:border-border/25 sm:border-b-0"
              />
              <InfoCell
                icon={<BookmarkGlyph className="h-5 w-5" />}
                label="Reason"
                value={request.reason?.label ?? "—"}
                className="sm:border-t sm:border-border/25 sm:border-b-0"
              />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {request.reasonText ? (
              <NotesBlock title="Reason for leave">{request.reasonText}</NotesBlock>
            ) : null}
            {request.coverRequirements ? (
              <NotesBlock title="Cover requirements">{request.coverRequirements}</NotesBlock>
            ) : null}
            {request.medicalEvidenceUrl ? (
              <NotesBlock title="Medical evidence">
                <a
                  href={request.medicalEvidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-accent font-medium"
                >
                  View uploaded document
                </a>
              </NotesBlock>
            ) : null}
            {request.notes ? <NotesBlock title="Notes">{request.notes}</NotesBlock> : null}
          </div>

          <p className="mt-6 flex items-center gap-2 text-[0.8125rem] text-muted">
            <CalendarGlyph muted className="h-4 w-4 shrink-0 opacity-80" />
            <span>
              Submitted <span className="font-medium text-text">{fmtSubmitted(new Date(request.createdAt))}</span>
            </span>
          </p>
        </div>
      </div>

      {manager && status === "PENDING" && (
        <div className={`${surfaceCard} overflow-hidden`}>
          <div className="border-b border-border/25 px-5 py-5 sm:px-7">
            <h2 className="text-lg font-bold text-text">Make a decision</h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              Your decision will be recorded with a timestamp.
            </p>
          </div>
          <form action={decideLoaRequest} className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
            <input type="hidden" name="requestId" value={request.id} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border-2 border-emerald-400/70 bg-emerald-50/90 p-4 calm-transition hover:border-emerald-500 dark:border-emerald-700/60 dark:bg-emerald-950/35 has-[:checked]:ring-2 has-[:checked]:ring-emerald-500/35 dark:has-[:checked]:ring-emerald-400/25">
                <input type="radio" name="decisionType" value="APPROVED_WITH_PAY" defaultChecked className="sr-only peer" />
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-white text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[0.8125rem] font-bold leading-snug text-emerald-800 dark:text-emerald-100">
                  Approve with pay
                </span>
              </label>

              <label className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border-2 border-amber-400/80 bg-amber-50/95 p-4 calm-transition hover:border-amber-500 dark:border-amber-700/55 dark:bg-amber-950/40 has-[:checked]:ring-2 has-[:checked]:ring-amber-500/35 dark:has-[:checked]:ring-amber-400/25">
                <input type="radio" name="decisionType" value="APPROVED_WITHOUT_PAY" className="sr-only peer" />
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-500/45 bg-white text-amber-600 dark:bg-amber-950/80 dark:text-amber-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[0.8125rem] font-bold leading-snug text-amber-900 dark:text-amber-100">
                  Approve without pay
                </span>
              </label>

              <label className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border-2 border-red-300/90 bg-red-50/90 p-4 calm-transition hover:border-red-400 dark:border-red-800/55 dark:bg-red-950/35 has-[:checked]:ring-2 has-[:checked]:ring-red-500/30 dark:has-[:checked]:ring-red-400/25">
                <input type="radio" name="decisionType" value="DENIED" className="sr-only peer" />
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-400/45 bg-white text-red-600 dark:bg-red-950/80 dark:text-red-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-[0.8125rem] font-bold leading-snug text-red-800 dark:text-red-100">Deny</span>
              </label>
            </div>

            <div className="space-y-2">
              <label htmlFor="decision-notes" className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Decision notes <span className="font-normal normal-case tracking-normal text-muted">· optional</span>
              </label>
              <textarea
                id="decision-notes"
                name="decisionNotes"
                rows={4}
                className="field min-h-[100px] w-full resize-y rounded-xl border-border/40"
                placeholder="Any notes for the requester..."
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-xl bg-neutral-950 py-3.5 text-[0.9375rem] font-semibold text-white shadow-sm calm-transition hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
            >
              Save decision
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
