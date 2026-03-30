import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { decideLoaRequest } from "../actions";

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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

const STATUS_STYLES: Record<string, { badge: string; icon: React.ReactNode; label: string }> = {
  PENDING: {
    badge: "border-scale-some-border bg-scale-some-bg text-scale-some-text",
    label: "Pending approval",
    icon: (
      <svg className="h-4 w-4 text-scale-some-bar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
  APPROVED_WITH_PAY: {
    badge: "border-status-approved-border bg-status-approved-bg text-status-approved-text",
    label: "Approved with pay",
    icon: (
      <svg className="h-4 w-4 text-scale-strong-bar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  APPROVED_WITHOUT_PAY: {
    badge: "border-scale-some-border bg-scale-some-bg text-scale-some-text",
    label: "Approved without pay",
    icon: (
      <svg className="h-4 w-4 text-scale-some-bar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  APPROVED: {
    badge: "border-status-approved-border bg-status-approved-bg text-status-approved-text",
    label: "Approved",
    icon: (
      <svg className="h-4 w-4 text-scale-strong-bar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  DENIED: {
    badge: "border-status-denied-border bg-status-denied-bg text-status-denied-text",
    label: "Denied",
    icon: (
      <svg className="h-4 w-4 text-scale-limited-bar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
};

export default async function LeaveDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> }) {
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

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Back */}
      <Link
        href={fromCalendar ? "/leave/calendar" : "/leave"}
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {fromCalendar ? "Leave calendar" : "Leave requests"}
      </Link>

      {/* Hero card */}
      <div className="overflow-hidden rounded-2xl glass-card">
        <div className="px-6 py-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">Leave request</p>
              <p className="mt-1 text-[1.125rem] font-bold text-text">{request.requester?.fullName ?? "Staff member"}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8125rem] font-semibold ${statusStyle.badge}`}>
              {statusStyle.icon}
              {statusStyle.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/30 bg-surface-container-lowest/50 p-4">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">Start</p>
              <p className="mt-1 text-[0.9375rem] font-semibold text-text">{fmt(startDate)}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">End</p>
              <p className="mt-1 text-[0.9375rem] font-semibold text-text">{fmt(endDate)}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">Duration</p>
              <p className="mt-1 text-[0.9375rem] font-semibold text-text">{days} school day{days !== 1 ? "s" : ""}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">Reason</p>
              <p className="mt-1 text-[0.9375rem] font-semibold text-text">{request.reason?.label ?? "—"}</p>
            </div>
          </div>

          {request.reasonText && (
            <div className="mt-4 rounded-xl border border-border/30 bg-surface-container-lowest/40 px-4 py-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">Reason for leave</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-text">{request.reasonText}</p>
            </div>
          )}

          {request.coverRequirements && (
            <div className="mt-4 rounded-xl border border-border/30 bg-surface-container-lowest/40 px-4 py-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">Cover requirements</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-text">{request.coverRequirements}</p>
            </div>
          )}

          {request.medicalEvidenceUrl && (
            <div className="mt-4 rounded-xl border border-border/30 bg-surface-container-lowest/40 px-4 py-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">Medical evidence</p>
              <p className="mt-1.5 text-[0.875rem] text-accent underline">
                <a href={request.medicalEvidenceUrl} target="_blank" rel="noopener noreferrer">View uploaded document</a>
              </p>
            </div>
          )}

          {request.notes && (
            <div className="mt-4 rounded-xl border border-border/30 bg-surface-container-lowest/40 px-4 py-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">Notes</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-text">{request.notes}</p>
            </div>
          )}

          <p className="mt-4 text-[0.75rem] text-muted">
            Submitted {new Date(request.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Decision form — manager + pending only */}
      {manager && status === "PENDING" && (
        <div className="overflow-hidden rounded-2xl glass-card">
          <div className="border-b border-border/30 px-6 py-4">
            <h2 className="text-[0.9375rem] font-semibold text-text">Make a decision</h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted">Your decision will be recorded with a timestamp.</p>
          </div>
          <form action={decideLoaRequest} className="space-y-4 px-6 py-5">
            <input type="hidden" name="requestId" value={request.id} />

            {/* Decision buttons */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-status-approved-border bg-status-approved-bg/60 p-3.5 calm-transition has-[:checked]:ring-1 has-[:checked]:border-status-approved has-[:checked]:ring-status-approved-border/50">
                <input type="radio" name="decisionType" value="APPROVED_WITH_PAY" defaultChecked className="sr-only" />
                <svg className="h-4 w-4 text-scale-strong-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[0.8125rem] font-semibold leading-tight text-scale-strong-text">Approve with pay</span>
              </label>

              <label className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-scale-some-border bg-scale-some-bg/60 p-3.5 calm-transition has-[:checked]:ring-1 has-[:checked]:border-scale-some-bar has-[:checked]:ring-scale-some-border/50">
                <input type="radio" name="decisionType" value="APPROVED_WITHOUT_PAY" className="sr-only" />
                <svg className="h-4 w-4 text-scale-some-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[0.8125rem] font-semibold leading-tight text-scale-some-text">Approve without pay</span>
              </label>

              <label className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-error/20 bg-error-container/30 p-3.5 calm-transition has-[:checked]:ring-1 has-[:checked]:border-error has-[:checked]:ring-error/20">
                <input type="radio" name="decisionType" value="DENIED" className="sr-only" />
                <svg className="h-4 w-4 text-scale-limited-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span className="text-[0.8125rem] font-semibold leading-tight text-scale-limited-text">Deny</span>
              </label>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label htmlFor="decision-notes" className="block text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                Decision notes <span className="font-normal normal-case tracking-normal">· optional</span>
              </label>
              <textarea
                id="decision-notes"
                name="decisionNotes"
                rows={3}
                className="field min-h-[80px] resize-y"
                placeholder="Any notes for the requester…"
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[0.9375rem] font-semibold text-on-primary shadow-sm calm-transition hover:bg-accentHover"
            >
              Save decision
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
