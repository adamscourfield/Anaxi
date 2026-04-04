import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { createLoaRequest } from "../actions";
import { FormSelect } from "@/components/ui/form-select";

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

export default async function LeaveRequestPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const reasons = await prisma.loaReason.findMany({
    where: { tenantId: user.tenantId, active: true },
    orderBy: { label: "asc" },
  });

  const today = new Date().toISOString().slice(0, 10);

  /* ── Past 12 months summary ───────────────────────────────────────────── */
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const pastRequests = await (prisma as any).lOARequest.findMany({
    where: {
      tenantId: user.tenantId,
      requesterId: user.id,
      status: { in: ["APPROVED", "PENDING"] },
      startDate: { gte: twelveMonthsAgo },
    },
    include: { reason: true },
  });

  const leaveSummary: Record<string, number> = {};
  for (const req of pastRequests as any[]) {
    const label = req.reason?.label ?? "Other";
    const days = businessDays(new Date(req.startDate), new Date(req.endDate));
    leaveSummary[label] = (leaveSummary[label] || 0) + days;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Request Leave"
        subtitle="Submit a formal absence request for administrative review. Please ensure all medical documentation is attached for relevant claims."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ── Left column: Form ──────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <form action={createLoaRequest} className="space-y-6">
            {/* Date row */}
            <div className="rounded-2xl glass-card p-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="loa-start" className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                    </svg>
                    Start date
                  </label>
                  <input
                    id="loa-start"
                    required
                    type="date"
                    name="startAt"
                    defaultValue={today}
                    className="field"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="loa-end" className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                    </svg>
                    End date
                  </label>
                  <input
                    id="loa-end"
                    required
                    type="date"
                    name="endAt"
                    defaultValue={today}
                    className="field"
                  />
                </div>
              </div>
            </div>

            {/* Reason for leave */}
            <div className="rounded-2xl glass-card p-5">
              <div className="space-y-3">
                <label htmlFor="loa-reason" className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                  Reason for leave
                </label>
                <FormSelect
                  name="reasonId"
                  placeholder="Select leave type…"
                  options={reasons.map((reason: any) => ({ value: reason.id, label: reason.label }))}
                />
                <textarea
                  id="loa-reason-text"
                  name="reasonText"
                  className="field min-h-[100px] resize-y"
                  placeholder="Briefly explain the necessity for absence..."
                  rows={4}
                />
              </div>
            </div>

            {/* Cover requirements */}
            <div className="rounded-2xl glass-card p-5">
              <div className="space-y-2">
                <label htmlFor="loa-cover" className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                  Cover requirements
                </label>
                <textarea
                  id="loa-cover"
                  name="coverRequirements"
                  className="field min-h-[100px] resize-y"
                  placeholder="Specify classes or duties requiring coverage..."
                  rows={4}
                />
              </div>
            </div>

            {/* Medical evidence */}
            <div className="rounded-2xl glass-card p-5">
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M12 8v8M8 12h8" strokeLinecap="round" />
                  </svg>
                  Medical evidence
                </label>
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-surface/30 py-10">
                  <svg className="mb-3 h-8 w-8 text-muted/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M12 18v-6M9 15l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-[0.875rem] font-medium text-muted">Click to upload or drag and drop</p>
                  <p className="mt-1 text-[0.75rem] text-muted/70">PDF, JPG OR PNG (MAX 5MB)</p>
                  <input type="hidden" name="medicalEvidenceUrl" value="" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/leave"
                className="text-[0.875rem] font-medium text-accent calm-transition hover:text-accentHover"
              >
                Cancel Request
              </Link>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-[0.9375rem] font-semibold text-on-primary shadow-sm calm-transition hover:bg-accentHover"
              >
                Submit Request
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                  <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* ── Right column: Sidebar ──────────────────────────────────── */}
        <div className="space-y-6">
          {/* Institutional policy */}
          <div className="rounded-2xl glass-card px-5 py-5">
            <h3 className="mb-4 text-[0.9375rem] font-bold text-text">Institutional Policy</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-low">
                  <svg className="h-3 w-3 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-muted">
                  Requests must be submitted at least 48 hours prior to the requested start date for planned absences.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-3 w-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-muted">
                  Medical certificates are mandatory for all absences exceeding two consecutive working days.
                </p>
              </div>
            </div>
          </div>

          {/* Past 12 months summary */}
          <div className="rounded-2xl glass-card px-5 py-5">
            <h4 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
              Past 12 months
            </h4>
            {Object.keys(leaveSummary).length === 0 ? (
              <p className="text-[0.8125rem] text-muted">No leave taken in the past 12 months.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(leaveSummary).map(([label, days]) => (
                  <div key={label} className="flex items-center justify-between border-b border-border/20 pb-3 last:border-0 last:pb-0">
                    <span className="text-[0.875rem] font-medium text-text">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-container-low">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.min(100, (days / 20) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[0.8125rem] font-semibold tabular-nums text-text">
                        {days} Day{days !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Support contact */}
          <div className="rounded-2xl border border-scale-some-border bg-scale-some-bg/40 px-5 py-5">
            <p className="mb-3 text-[0.8125rem] italic leading-relaxed text-scale-some-text">
              &ldquo;Ensuring educational continuity is our priority. Please ensure your cover notes are detailed.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-[0.75rem] font-semibold text-accent">
                HR
              </div>
              <div>
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-text">Support contact</p>
                <p className="text-[0.8125rem] text-muted">hr@stedwards.edu</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
