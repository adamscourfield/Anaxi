import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeatureForPage } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { businessDaysBetween } from "@/lib/leaveDates";
import { isPendingStatus, loaStatusLabel, normalizeLoaStatus } from "@/lib/leaveStatus";
import { prisma } from "@/lib/prisma";
import { cancelLoaRequest, decideLoaRequest } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

const LEAVE_ELEVATED_CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmtSubmitted(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function CalendarGlyph({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={muted ? "currentColor" : "var(--accent)"}
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STATUS_STYLES: Record<string, { badge: string; iconWrap: string; icon: ReactNode; label: string }> = {
  PENDING: {
    badge: "border border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412]",
    iconWrap: "text-[#EA580C]",
    label: "Pending approval",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
  APPROVED_WITH_PAY: {
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-900",
    iconWrap: "text-emerald-600",
    label: "Approved with pay",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  APPROVED_WITHOUT_PAY: {
    badge: "border border-amber-200 bg-amber-50 text-amber-950",
    iconWrap: "text-amber-600",
    label: "Approved without pay",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  APPROVED: {
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-900",
    iconWrap: "text-emerald-600",
    label: "Approved",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  CANCELLED: {
    badge: "border border-border bg-[var(--surface-container-low)] text-muted",
    iconWrap: "text-muted",
    label: "Cancelled",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
  DENIED: {
    badge: "border border-red-200 bg-red-50 text-red-900",
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
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <p className="mt-1 text-[0.9375rem] font-bold leading-snug text-text">
          {value}
        </p>
      </div>
    </div>
  );
}

function NotesBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--surface-container-lowest)] px-4 py-4 sm:px-5">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-accent">
          <DocGlyph className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            {title}
          </p>
          <div className="mt-1.5 text-[0.875rem] leading-relaxed text-text">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LeaveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeatureForPage(user.tenantId, "LEAVE");
  const resolvedParams = await params;
  const query = (await searchParams) ?? {};

  const request = await prisma.lOARequest.findFirst({
    where: { id: resolvedParams.id, tenantId: user.tenantId },
    include: { requester: true, reason: true },
  });
  if (!request) notFound();

  const isOwner = request.requesterId === user.id;
  const manager = !isOwner && (await canManageLoa(user, request.requesterId));
  if (!manager && !isOwner) notFound();

  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);
  const days = businessDaysBetween(startDate, endDate);
  const status = normalizeLoaStatus(request.status) as string;
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
  const canCancel = isOwner && isPendingStatus(request.status);

  const fromCalendar = query.from === "calendar";
  const calendarMonth = String(query.month || "");
  const calendarBackHref =
    fromCalendar && /^\d{4}-\d{2}$/.test(calendarMonth)
      ? `/leave/calendar?month=${calendarMonth}`
      : fromCalendar
        ? "/leave/calendar"
        : "/leave";

  const surfaceCard = LEAVE_ELEVATED_CARD;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 pt-1 md:pb-8">
      <PageHeader
        variant="ledger"
        title={request.requester?.fullName ?? "Staff member"}
        eyebrow={
          <Breadcrumb
            items={[
              { label: "Leave", href: "/leave" },
              { label: "Request detail" },
            ]}
          />
        }
        meta={
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-1.5 text-[0.8125rem] font-semibold ${statusStyle.badge}`}
          >
            <span className={statusStyle.iconWrap}>{statusStyle.icon}</span>
            {loaStatusLabel(status)}
          </span>
        }
        actions={
          <Button variant="secondary" asChild>
            <Link href={calendarBackHref}>{fromCalendar ? "Back to calendar" : "Back to requests"}</Link>
          </Button>
        }
      />

      {/* Request summary */}
      <div className={surfaceCard}>
        <div className="px-6 py-7 sm:px-8 sm:py-8">

          <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-container-lowest)]">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <InfoCell
                icon={<CalendarGlyph className="h-5 w-5" />}
                label="Start"
                value={fmt(startDate)}
                className="border-b border-border sm:border-r sm:border-b-0"
              />
              <InfoCell
                icon={<CalendarGlyph className="h-5 w-5" />}
                label="End"
                value={fmt(endDate)}
                className="border-b border-border sm:border-b-0"
              />
              <InfoCell
                icon={<ClockGlyph className="h-5 w-5" />}
                label="Duration"
                value={`${days} school day${days !== 1 ? "s" : ""}`}
                className="border-b border-border sm:border-r sm:border-t sm:border-border sm:border-b-0"
              />
              <InfoCell
                icon={<BookmarkGlyph className="h-5 w-5" />}
                label="Reason"
                value={request.reason?.label ?? "—"}
                className="sm:border-t sm:border-border sm:border-b-0"
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
            {request.notes ? <NotesBlock title="Additional notes">{request.notes}</NotesBlock> : null}
            {request.decisionNotes ? (
              <NotesBlock title="Decision notes">{request.decisionNotes}</NotesBlock>
            ) : null}
          </div>

          <p className="mt-6 flex items-center gap-2 text-[0.8125rem] text-muted">
            <CalendarGlyph muted className="h-4 w-4 shrink-0 opacity-80" />
            <span>
              Submitted <span className="font-medium text-text">{fmtSubmitted(new Date(request.createdAt))}</span>
            </span>
          </p>
        </div>
      </div>

      {canCancel ? (
        <div className={surfaceCard}>
          <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <h2 className="text-lg font-bold text-text">Withdraw request</h2>
              <p className="mt-1 text-[0.8125rem] text-muted">
                Cancel this request before it is decided. You can submit a new request later.
              </p>
            </div>
            <form action={cancelLoaRequest}>
              <input type="hidden" name="requestId" value={request.id} />
              <button
                type="submit"
                className="rounded-xl border border-[color-mix(in_srgb,var(--error)_40%,transparent)] px-5 py-2.5 text-[0.875rem] font-semibold text-[var(--error)] calm-transition hover:bg-[var(--status-denied-light)]"
              >
                Cancel request
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="leave-audit-heading" className={surfaceCard}>
        <div className="border-b border-border px-6 py-5 sm:px-8">
          <h2 id="leave-audit-heading" className="text-lg font-bold text-text">
            Audit trail
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Submitted {fmtSubmitted(new Date(request.createdAt))}
            {request.updatedAt ? ` · Last updated ${fmtSubmitted(new Date(request.updatedAt))}` : ""}
          </p>
        </div>
      </section>

      {manager && isPendingStatus(request.status) ? (
        <div className={`${surfaceCard} md:static fixed inset-x-0 bottom-0 z-30 border-t border-border md:border-t-0`}>
          <div className="hidden border-b border-border px-6 py-6 sm:px-8 md:block">
            <h2 className="text-lg font-bold text-text">Make a decision</h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              Your decision will be recorded with a timestamp.
            </p>
          </div>
          <p className="px-6 pt-4 text-sm font-semibold text-text md:hidden">Approve or deny</p>
          <form action={decideLoaRequest} className="space-y-6 px-6 py-5 sm:px-8 sm:py-8">
            <input type="hidden" name="requestId" value={request.id} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-emerald-500 bg-[#ECFDF5] p-4 calm-transition hover:bg-[#D1FAE5] has-[:checked]:ring-2 has-[:checked]:ring-emerald-500/25">
                <input type="radio" name="decisionType" value="APPROVED_WITH_PAY" defaultChecked className="sr-only peer" />
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-500/50 bg-white text-emerald-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[0.8125rem] font-bold leading-snug text-emerald-800">Approve with pay</span>
              </label>

              <label className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-orange-500 bg-[#FFF7ED] p-4 calm-transition hover:bg-[#FFEDD5] has-[:checked]:ring-2 has-[:checked]:ring-orange-500/25">
                <input type="radio" name="decisionType" value="APPROVED_WITHOUT_PAY" className="sr-only peer" />
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-orange-500/50 bg-white text-orange-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[0.8125rem] font-bold leading-snug text-[#9A3412]">Approve without pay</span>
              </label>

              <label className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-red-500 bg-[#FEF2F2] p-4 calm-transition hover:bg-[#FEE2E2] has-[:checked]:ring-2 has-[:checked]:ring-red-500/25">
                <input type="radio" name="decisionType" value="DENIED" className="sr-only peer" />
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-red-500/50 bg-white text-red-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-[0.8125rem] font-bold leading-snug text-red-800">Deny</span>
              </label>
            </div>

            <div className="space-y-2">
              <label htmlFor="decision-notes" className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Decision notes <span className="font-normal normal-case tracking-normal">· optional</span>
              </label>
              <textarea
                id="decision-notes"
                name="decisionNotes"
                rows={4}
                className="field min-h-[100px] w-full resize-y rounded-xl"
                placeholder="Any notes for the requester..."
              />
            </div>

            <SubmitButton className="flex w-full items-center justify-center rounded-xl py-3.5 text-[0.9375rem]">
              Save decision
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
