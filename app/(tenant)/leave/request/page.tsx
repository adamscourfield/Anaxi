import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeatureForPage } from "@/lib/guards";
import { businessDaysBetween } from "@/lib/leaveDates";
import { leavePolicyMessageForCode, LEAVE_MEDICAL_MIN_BUSINESS_DAYS } from "@/lib/leavePolicy";
import { approvedStatusFilter, isPendingStatus } from "@/lib/leaveStatus";
import { prisma } from "@/lib/prisma";
import { createLoaRequest } from "../actions";
import { LeaveDateTimeFields } from "./LeaveDateTimeFields";
import { LeaveReasonFields } from "./LeaveReasonFields";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default async function LeaveRequestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeatureForPage(user.tenantId, "LEAVE");
  const params = (await searchParams) ?? {};
  const reasons = await prisma.loaReason.findMany({
    where: { tenantId: user.tenantId, active: true },
    orderBy: { label: "asc" },
  });

  const today = new Date().toISOString().slice(0, 16);

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const pastRequests = await prisma.lOARequest.findMany({
    where: {
      tenantId: user.tenantId,
      requesterId: user.id,
      status: { in: ["PENDING", ...approvedStatusFilter()] },
      startDate: { gte: twelveMonthsAgo },
    },
    include: { reason: true },
  });

  const errorCode = String(params.error || "");
  const errorMessage = errorCode ? leavePolicyMessageForCode(errorCode) : null;

  const leaveSummary: Record<string, number> = {};
  for (const req of pastRequests) {
    if (!isPendingStatus(req.status) && !approvedStatusFilter().includes(req.status)) continue;
    const label = req.reason?.label ?? "Other";
    const days = businessDaysBetween(new Date(req.startDate), new Date(req.endDate));
    leaveSummary[label] = (leaveSummary[label] || 0) + days;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        variant="ledger"
        title="Request leave"
        subtitle="Submit a formal absence request for administrative review. Attach medical documentation when required."
        eyebrow={
          <Breadcrumb
            items={[
              { label: "Leave", href: "/leave" },
              { label: "Request" },
            ]}
          />
        }
        actions={
          <Button variant="secondary" asChild>
            <Link href="/leave">Back to leave</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_06%,var(--surface-container-lowest))] px-4 py-3 text-[0.875rem] text-[var(--error)]"
            >
              {errorMessage}
            </div>
          ) : null}
          <form action={createLoaRequest} encType="multipart/form-data" className="space-y-5">
            <div className="home-hero-glass rounded-sm border border-border p-5 shadow-none sm:p-6">
              <LeaveDateTimeFields defaultValue={today} />
            </div>

            <LeaveReasonFields
              reasons={reasons.map((reason: any) => ({
                id: reason.id,
                label: reason.label,
                requiresMedicalEvidence: reason.requiresMedicalEvidence,
              }))}
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
              <SubmitButton className="w-full gap-2 rounded-md px-8 py-3 shadow-md sm:ml-auto sm:w-auto" pendingLabel="Submitting…">
                Submit Request
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                  <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </SubmitButton>
            </div>
          </form>
        </div>

        <div className="space-y-5">
          <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] px-5 py-5 sm:px-6">
            <h3 className="mb-4 text-base font-bold tracking-[-0.02em] text-text">Institutional Policy</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--status-approved-light)] text-[var(--status-approved-text)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-muted">
                  Medical evidence is required for medical absences of {LEAVE_MEDICAL_MIN_BUSINESS_DAYS} or more consecutive working days. Not required for other leave types.
                </p>
              </div>
            </div>
          </div>

          <div className="explorer-kpi-tile flex gap-4 rounded-2xl p-5 sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--cat-violet-bg)] text-[var(--cat-violet-text)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Past 12 months</p>
              {Object.keys(leaveSummary).length === 0 ? (
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">No leave taken in the past 12 months.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {Object.entries(leaveSummary).map(([label, days]) => (
                    <div key={label} className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] pb-3 last:border-0 last:pb-0">
                      <span className="text-[0.875rem] font-semibold text-text">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-14 overflow-hidden rounded-sm bg-[var(--surface-container-high)]">
                          <div
                            className="h-full rounded-md bg-[var(--accent)]"
                            style={{ width: `${Math.min(100, (days / 20) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[0.8125rem] font-bold tabular-nums text-text">
                          {days} day{days !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border-l-[3px] border-l-[var(--warning)] bg-[color-mix(in_srgb,var(--pill-warning-bg)_55%,var(--surface-container-lowest))] px-5 py-5 ring-1 ring-inset ring-[color-mix(in_srgb,var(--pill-warning-ring)_35%,transparent)]">
            <p className="text-[1.35rem] font-serif leading-none text-[var(--warning)]">&ldquo;</p>
            <p className="mt-2 text-[0.8125rem] italic leading-relaxed text-[var(--warning-text)]">
              Ensuring educational continuity is our priority. Please ensure your cover notes are detailed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
