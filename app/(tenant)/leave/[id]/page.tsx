import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeatureForPage } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { businessDaysBetween, formatLeaveBoundary, formatLeaveRange, leaveDayKey } from "@/lib/leaveDates";
import { isPendingStatus, loaStatusLabel, loaStatusUiBucket, normalizeLoaStatus } from "@/lib/leaveStatus";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { cancelLoaRequest, decideLoaRequest } from "../actions";
import { DeleteLoaRequestButton } from "../DeleteLoaRequestButton";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { SubmitButton } from "@/components/ui/submit-button";
import styles from "./page.module.css";

const ERRORS: Record<string, string> = {
  CHOOSE_DECISION: "Choose approve with pay, approve without pay, or deny.",
  ALREADY_DECIDED: "This request was decided or cancelled before your change was saved. Here's where it stands now.",
  OWN_REQUEST: "You can't decide your own leave request.",
  NOTES_TOO_LONG: "Keep decision notes under 2,000 characters.",
};

const UK_STAMP: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Europe/London",
};

function pillVariant(status: string) {
  const bucket = loaStatusUiBucket(status);
  if (bucket === "APPROVED") return normalizeLoaStatus(status) === "APPROVED_WITHOUT_PAY" ? "warning" : "success";
  if (bucket === "DENIED") return "error";
  if (bucket === "CANCELLED") return "neutral";
  return "warning";
}

const DECISIONS = [
  { value: "APPROVED_WITH_PAY", label: "Approve with pay", body: "Paid leave." },
  { value: "APPROVED_WITHOUT_PAY", label: "Approve without pay", body: "Leave is unpaid." },
  { value: "DENIED", label: "Deny", body: "Say why in the notes." },
] as const;

export default async function LeaveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeatureForPage(user.tenantId, "LEAVE");
  const { id } = await params;
  const query = (await searchParams) ?? {};

  const request = await prisma.lOARequest.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { requester: { select: { id: true, fullName: true } }, reason: true },
  });
  if (!request) notFound();

  const isOwner = request.requesterId === user.id;
  const manager = !isOwner && (await canManageLoa(user, request.requesterId));
  if (!manager && !isOwner) notFound();

  const decidedBy =
    request.decidedById && request.decidedById !== request.requesterId
      ? await prisma.user.findFirst({
          where: { id: request.decidedById, tenantId: user.tenantId },
          select: { fullName: true },
        })
      : null;

  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);
  const days = businessDaysBetween(startDate, endDate);
  const pending = isPendingStatus(request.status);
  const status = normalizeLoaStatus(request.status) as string;
  const canCancel = isOwner && pending;
  const canDecide = manager && pending;
  const canDelete = hasPermission(user.role, "leave:delete");

  const fromCalendar = query.from === "calendar";
  const calendarMonth = String(query.month || "");
  const backHref =
    fromCalendar && /^\d{4}-\d{2}$/.test(calendarMonth)
      ? `/leave?view=calendar&month=${calendarMonth}`
      : fromCalendar
        ? "/leave?view=calendar"
        : "/leave";

  const error = ERRORS[String(query.error || "")] ?? null;
  const justDecided = query.decided === "1" && !pending;
  const sameDay = leaveDayKey(startDate) === leaveDayKey(endDate);
  const name = request.requester?.fullName ?? "Unknown member of staff";
  const evidenceHref =
    request.medicalEvidenceUrl && request.medicalEvidenceUrl.startsWith("/api/leave/evidence/") ? request.medicalEvidenceUrl : null;

  const facts: [string, string][] = [
    ...((sameDay
      ? [["Date", formatLeaveRange(startDate, endDate, -1)]]
      : [
          ["From", formatLeaveBoundary(startDate)],
          ["Until", formatLeaveBoundary(endDate)],
        ]) as [string, string][]),
    ["Working days", String(days)],
    ["Type", request.reason?.label ?? "Leave"],
    ["Sent", new Date(request.createdAt).toLocaleString("en-GB", UK_STAMP)],
  ];
  if (!pending && request.decidedAt) {
    const when = new Date(request.decidedAt).toLocaleString("en-GB", UK_STAMP);
    facts.push(
      status === "CANCELLED"
        ? ["Cancelled", when]
        : ["Decided", decidedBy ? `${when} by ${decidedBy.fullName}` : when],
    );
  }

  const notes: [string, string][] = [];
  if (request.reasonText) notes.push(["Details", request.reasonText]);
  if (request.coverRequirements) notes.push(["Cover needed", request.coverRequirements]);
  if (request.notes) notes.push(["Notes", request.notes]);

  return (
    <div className={`${styles.page} mx-auto w-full max-w-3xl space-y-6 pb-16`}>
      <PageHeader
        title={isOwner ? "Your leave request" : name}
        eyebrow={<Breadcrumb items={[{ label: "Leave", href: backHref }, { label: isOwner ? "Your request" : name }]} />}
        meta={<StatusPill variant={pillVariant(request.status)}>{pending ? "Waiting for a decision" : loaStatusLabel(status)}</StatusPill>}
        actions={
          <Button variant="secondary" asChild className="h-10 min-h-0 px-4">
            <Link href={backHref}>{fromCalendar ? "Back to calendar" : "Back to leave"}</Link>
          </Button>
        }
      />

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : justDecided ? (
        <p role="status" className={styles.saved}>
          Decision saved.
        </p>
      ) : null}

      <section className={styles.card} aria-label="Request">
        <dl className={styles.facts}>
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {notes.length || evidenceHref ? (
          <div className={styles.notes}>
            {notes.map(([k, v]) => (
              <div key={k}>
                <h2>{k}</h2>
                <p>{v}</p>
              </div>
            ))}
            {evidenceHref ? (
              <div>
                <h2>Evidence</h2>
                <p>
                  <a href={evidenceHref} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    Open the uploaded file
                  </a>
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {request.decisionNotes ? (
        <section className={`${styles.card} p-6`}>
          <h2 className="text-[15px] font-semibold">{decidedBy ? `Note from ${decidedBy.fullName.split(" ")[0]}` : "Decision note"}</h2>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{request.decisionNotes}</p>
        </section>
      ) : null}

      {canDecide ? (
        <section className={`${styles.card} p-6`} aria-labelledby="leave-decide">
          <h2 id="leave-decide" className="text-[17px] font-semibold tracking-[-0.02em]">
            Your decision
          </h2>
          <p className="mt-1 text-[13px] text-[#6e6e73]">{name.split(" ")[0]} is told as soon as you save.</p>
          <form action={decideLoaRequest} className="mt-5 space-y-5">
            <input type="hidden" name="requestId" value={request.id} />
            <fieldset>
              <legend className="sr-only">Decision</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DECISIONS.map((d) => (
                  <label key={d.value} className={styles.choice} data-tone={d.value === "DENIED" ? "deny" : undefined}>
                    <input type="radio" name="decisionType" value={d.value} required className="sr-only" />
                    <span className={styles.choiceTitle}>
                      {d.label}
                      <span className={styles.radio} aria-hidden />
                    </span>
                    <span className={styles.choiceBody}>{d.body}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">
                Note to {name.split(" ")[0]} <span className="font-normal text-[#6e6e73]">(optional)</span>
              </span>
              <textarea
                name="decisionNotes"
                rows={3}
                maxLength={2000}
                className={styles.textarea}
                placeholder="e.g. Approved. Please leave cover work in the shared drive."
              />
            </label>
            <div className="flex justify-end">
              <SubmitButton className="h-11 min-h-0 px-6" pendingLabel="Saving…">
                Save decision
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {canCancel ? (
        <section className={`${styles.card} flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h2 className="text-[15px] font-semibold">Cancel this request</h2>
            <p className="mt-1 text-[13px] text-[#6e6e73]">You can do this until it&apos;s decided. You can send a new one any time.</p>
          </div>
          <form action={cancelLoaRequest}>
            <input type="hidden" name="requestId" value={request.id} />
            <SubmitButton variant="secondary" className="h-10 min-h-0 px-4" pendingLabel="Cancelling…">
              Cancel request
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {canDelete ? (
        <section className={`${styles.card} flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h2 className="text-[15px] font-semibold">Delete request</h2>
            <p className="mt-1 text-[13px] text-[#6e6e73]">Removes it from every record, including history. This can&apos;t be undone.</p>
          </div>
          <DeleteLoaRequestButton requestId={request.id} />
        </section>
      ) : null}
    </div>
  );
}
