import Link from "next/link";
import styles from "./page.module.css";
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

  // Today in the UK, with 9am as the starting time if they switch off "All day".
  const today = `${new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" })}T09:00`;
  // After a rejected submit, put back what they chose.
  const safe = (v: unknown, re: RegExp) => (typeof v === "string" && re.test(v) ? v : "");
  const DT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
  const keptStart = safe(params.startAt, DT);
  const keptEnd = safe(params.endAt, DT);
  const keptReason = safe(params.reasonId, /^[\w-]{1,40}$/);

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
    <div className={`${styles.page} mx-auto max-w-5xl space-y-8`}>
      <PageHeader
        variant="ledger"
        title="Request leave"
        subtitle="Choose the dates and type of leave, then say what needs covering."
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-5 rounded-[10px] border border-[var(--pill-error-ring)] bg-[var(--pill-error-bg)] px-4 py-3 text-[14px] text-[var(--pill-error-text)]"
            >
              {errorMessage}
            </div>
          ) : null}
          <form action={createLoaRequest} encType="multipart/form-data" className="space-y-5">
            <div className={styles.card}>
              <LeaveDateTimeFields defaultValue={today} initialStart={keptStart} initialEnd={keptEnd} />
            </div>

            <LeaveReasonFields
              defaultReasonId={keptReason}
              reasons={reasons.map((reason: any) => ({
                id: reason.id,
                label: reason.label,
                requiresMedicalEvidence: reason.requiresMedicalEvidence,
              }))}
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
              <SubmitButton className="h-11 min-h-0 w-full px-6 sm:ml-auto sm:w-auto" pendingLabel="Sending…">
                Send request
              </SubmitButton>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <section className={styles.card}>
            <h2 className="text-[15px] font-semibold">Before you submit</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#6e6e73]">
              Medical leave of {LEAVE_MEDICAL_MIN_BUSINESS_DAYS} or more working days needs evidence, such as a fit note. Other types
              don&apos;t. Your request goes to the people who approve your leave, and you&apos;ll get an email when it&apos;s decided.
            </p>
          </section>

          <section className={styles.card}>
            <h2 className="text-[15px] font-semibold">Your last 12 months</h2>
            <p className="mt-1 text-[12px] text-[#6e6e73]">Approved and pending leave, in working days.</p>
            {Object.keys(leaveSummary).length === 0 ? (
              <p className="mt-4 text-[13px] text-[#6e6e73]">None so far.</p>
            ) : (
              <dl className="mt-3 divide-y divide-[#f0f0f1]">
                {Object.entries(leaveSummary)
                  .sort((x, y) => y[1] - x[1])
                  .map(([label, days]) => (
                    <div key={label} className="flex items-center justify-between py-2.5 text-[13px]">
                      <dt className="text-[#3a3a3c]">{label}</dt>
                      <dd className="font-semibold tabular-nums">
                        {days} day{days !== 1 ? "s" : ""}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
