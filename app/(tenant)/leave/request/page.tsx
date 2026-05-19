import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { businessDaysBetween } from "@/lib/leaveDates";
import { leavePolicyMessageForCode, LEAVE_MEDICAL_MIN_BUSINESS_DAYS, LEAVE_NOTICE_HOURS } from "@/lib/leavePolicy";
import { approvedStatusFilter, isPendingStatus } from "@/lib/leaveStatus";
import { prisma } from "@/lib/prisma";
import { createLoaRequest } from "../actions";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default async function LeaveRequestPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const reasons = await prisma.loaReason.findMany({
    where: { tenantId: user.tenantId, active: true },
    orderBy: { label: "asc" },
  });

  const today = new Date().toISOString().slice(0, 10);

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

  const errorCode = String(searchParams?.error || "");
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
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="loa-start" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Start date
                  </label>
                  <input
                    id="loa-start"
                    required
                    type="date"
                    name="startAt"
                    defaultValue={today}
                    className="field rounded-xl bg-[var(--surface-container-low)]/80"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="loa-end" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    End date
                  </label>
                  <input
                    id="loa-end"
                    required
                    type="date"
                    name="endAt"
                    defaultValue={today}
                    className="field rounded-xl bg-[var(--surface-container-low)]/80"
                  />
                </div>
              </div>
            </div>

            <div className="home-hero-glass rounded-sm border border-border p-5 shadow-none sm:p-6">
              <div className="space-y-4">
                <label htmlFor="loa-reason" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Reason for leave
                </label>
                <FormSelect
                  name="reasonId"
                  placeholder="Select leave type…"
                  triggerClassName="rounded-xl bg-[var(--surface-container-low)]/80"
                  options={reasons.map((reason: any) => ({ value: reason.id, label: reason.label }))}
                />
                <textarea
                  id="loa-reason-text"
                  name="reasonText"
                  className="field min-h-[100px] resize-y rounded-xl bg-[var(--surface-container-low)]/80"
                  placeholder="Briefly explain the necessity for absence..."
                  rows={4}
                />
              </div>
            </div>

            <div className="home-hero-glass rounded-sm border border-border p-5 shadow-none sm:p-6">
              <div className="space-y-3">
                <label htmlFor="loa-cover" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Cover requirements
                </label>
                <textarea
                  id="loa-cover"
                  name="coverRequirements"
                  className="field min-h-[100px] resize-y rounded-xl bg-[var(--surface-container-low)]/80"
                  placeholder="Specify classes or duties requiring coverage..."
                  rows={4}
                />
              </div>
            </div>

            <div className="home-hero-glass rounded-sm border border-border p-5 shadow-none sm:p-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M12 8v8M8 12h8" strokeLinecap="round" />
                  </svg>
                  Medical evidence
                </label>
                <label
                  htmlFor="loa-medical"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] bg-[var(--surface-container-low)]/40 px-4 py-8 calm-transition hover:border-text/20"
                >
                  <svg className="mb-3 h-9 w-9 text-muted/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M12 18v-6M9 15l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-[0.875rem] font-semibold text-text">Choose file (PDF, JPG, PNG — max 5MB)</p>
                  <input
                    id="loa-medical"
                    type="file"
                    name="medicalEvidence"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="mt-3 max-w-full text-[0.75rem] text-muted file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-container-high)] file:px-3 file:py-1.5 file:text-[0.75rem] file:font-semibold file:text-text"
                  />
                </label>
                <p className="flex items-center gap-2 text-[11px] text-muted">
                  <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Your files are secure and only visible to authorized administrators.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
              <Button type="submit" className="w-full gap-2 rounded-md px-8 py-3 shadow-md sm:ml-auto sm:w-auto">
                Submit Request
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                  <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-5">
          <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] px-5 py-5 sm:px-6">
            <h3 className="mb-4 text-base font-bold tracking-[-0.02em] text-text">Institutional Policy</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-muted">
                  Requests must be submitted at least {LEAVE_NOTICE_HOURS} hours before the start date for planned absences.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--status-approved-light)] text-[var(--status-approved-text)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-muted">
                  Medical evidence is required for absences of {LEAVE_MEDICAL_MIN_BUSINESS_DAYS} or more consecutive working days.
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
