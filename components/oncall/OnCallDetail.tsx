"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/components/toast-provider";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";
import {
  LiveIndicator,
  StatusTag,
  TypeTag,
  formatDuration,
  formatWhen,
  formatYearGroup,
  since,
  useLiveRefresh,
  useOnCallAction,
  type OnCallStatus,
  type OnCallType,
} from "./shared";
import styles from "./OnCallDetail.module.css";

export type OnCallTimelineEventSerialized = {
  id: string;
  type: "CREATED" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  /** Null when the viewer may not see this time (resolve times). */
  createdAt: Date | string | null;
  actor?: { id: string; fullName: string } | null;
};

interface OnCallDetailRequest {
  id: string;
  status: OnCallStatus;
  requestType: OnCallType;
  isEmergency?: boolean;
  student: { id?: string; fullName: string; upn: string | null; yearGroup?: string | null };
  location: string;
  behaviourReasonCategory?: string | null;
  notes?: string | null;
  requester: { fullName: string };
  responder?: { id: string; fullName: string } | null;
  createdAt: Date | string;
  acknowledgedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  requesterUserId?: string;
  timelineEvents?: OnCallTimelineEventSerialized[];
}

interface OnCallDetailProps {
  request: OnCallDetailRequest;
  canAcknowledge?: boolean;
  canResolve?: boolean;
  canCancel?: boolean;
  canDelete?: boolean;
  /** SLT/Admin/Super Admin only -- everyone else sees that a request was resolved, not when. */
  canViewResolveTime?: boolean;
  /** Where the breadcrumb returns to -- preserves the inbox's filter state when set. */
  backHref?: string;
  /** The school's name for On Call (Admin › Language). */
  inboxLabel?: string;
}

const STEP_LABEL: Record<OnCallTimelineEventSerialized["type"], string> = {
  CREATED: "Raised",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

export function OnCallDetail({
  request,
  canAcknowledge,
  canResolve,
  canCancel,
  canDelete,
  canViewResolveTime,
  backHref = "/on-call",
  inboxLabel = "On Call",
}: OnCallDetailProps) {
  const router = useRouter();
  const action = useOnCallAction();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isLive = request.status === "OPEN" || request.status === "ACKNOWLEDGED";
  const { updatedAt, now } = useLiveRefresh(action.anyPending || !isLive);

  const busy = action.anyPending || deleting;
  const showAcknowledge = canAcknowledge && request.status === "OPEN";
  const showResolve = canResolve && isLive;
  const showCancel = canCancel && request.status === "OPEN";

  async function handleDelete() {
    setDeleteOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/oncall/${request.id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Call-out deleted.", "success");
        router.push(backHref);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast(typeof data?.error === "string" ? data.error : "The call-out wasn't deleted. Try again.", "error");
    } catch {
      toast("Couldn't reach Anaxi. Check your connection and try again.", "error");
    } finally {
      setDeleting(false);
    }
  }

  // The next step is the primary action; resolving straight from "Waiting" stays available as a secondary one.
  const primary = showAcknowledge ? "acknowledge" : showResolve ? "resolve" : null;
  const run = (kind: "acknowledge" | "resolve" | "cancel") => void action.run(request.id, kind);

  const timeline = buildTimeline(request);
  const yearAndUpn = [request.student.yearGroup ? formatYearGroup(request.student.yearGroup) : null, request.student.upn ? `UPN ${request.student.upn}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`${styles.page} w-full min-w-0 space-y-8 pb-28 md:pb-8`}>
      <header className="space-y-4 border-b border-[#e5e5e6] pb-7">
        <Breadcrumb items={[{ label: inboxLabel, href: backHref }, { label: request.student.fullName }]} />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.04em] text-[#1c1c1e]">
              {request.student.fullName}
              <span className="text-[#ff6a52]">.</span>
            </h1>
            {yearAndUpn ? <p className="mt-1 text-[15px] text-[#6e6e73]">{yearAndUpn}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusTag status={request.status} size="md" />
              <TypeTag type={request.requestType} emergency={request.isEmergency} />
              {isLive ? <LiveIndicator updatedAt={updatedAt} now={now} /> : null}
            </div>
          </div>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <ActionButtons
              primary={primary}
              showResolve={Boolean(showResolve)}
              showCancel={Boolean(showCancel)}
              busy={busy}
              isPending={(k) => action.isPending(request.id, k)}
              run={run}
            />
          </div>
        </div>
      </header>

      <StatusLine request={request} now={now} canViewResolveTime={canViewResolveTime} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start">
        <section className={styles.card} aria-labelledby="oncall-details-heading">
          <h2 id="oncall-details-heading" className="text-[15px] font-semibold text-[#1c1c1e]">
            Details
          </h2>
          <dl className={styles.details}>
            <Row label="Where">{request.location}</Row>
            <Row label="What's needed">
              <TypeTag type={request.requestType} />
            </Row>
            {request.behaviourReasonCategory ? <Row label="Reason">{request.behaviourReasonCategory}</Row> : null}
            <Row label="Notes">
              {request.notes ? (
                <span className="whitespace-pre-wrap">{request.notes}</span>
              ) : (
                <span className="text-[#a1a1aa]">None added</span>
              )}
            </Row>
            <Row label="Raised by">{request.requester.fullName}</Row>
            <Row label="Handled by">
              {request.responder ? request.responder.fullName : <span className="text-[#a1a1aa]">Nobody yet</span>}
            </Row>
          </dl>
          {request.student.id ? (
            <Link
              href={`/students/${request.student.id}`}
              className="mt-5 inline-flex text-[13px] font-medium text-[#1c1c1e] underline-offset-4 hover:underline"
            >
              View {request.student.fullName.split(" ")[0]}&rsquo;s profile
            </Link>
          ) : null}
        </section>

        <aside className={styles.card} aria-labelledby="oncall-timeline-heading">
          <h2 id="oncall-timeline-heading" className="text-[15px] font-semibold text-[#1c1c1e]">
            Timeline
          </h2>
          <ol className={styles.timeline}>
            {timeline.map((step) => (
              <li key={step.key} className={styles.step} data-state={step.state}>
                <span className={styles.dot} aria-hidden />
                <p className="text-[14px] font-semibold text-[#1c1c1e]">{step.label}</p>
                {step.state === "pending" ? (
                  <p className="text-[13px] text-[#a1a1aa]">{step.pendingText}</p>
                ) : (
                  <>
                    {step.at ? <p className="text-[13px] tabular-nums text-[#3a3a3c]">{formatWhen(step.at)}</p> : null}
                    {step.by ? <p className="text-[13px] text-[#6e6e73]">by {step.by}</p> : null}
                    {step.after ? <p className="text-[12px] text-[#6e6e73]">{step.after}</p> : null}
                  </>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {canDelete ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeleteOpen(true)}
            className="text-[13px] font-medium text-[var(--pill-error-text)] underline-offset-4 hover:underline disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete this call-out"}
          </button>
        </div>
      ) : null}

      {primary || showCancel ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5e6] bg-white/95 p-4 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg flex-wrap gap-2 [&>*]:flex-1 [&>*]:whitespace-nowrap">
            <ActionButtons
              primary={primary}
              showResolve={Boolean(showResolve)}
              showCancel={Boolean(showCancel)}
              busy={busy}
              isPending={(k) => action.isPending(request.id, k)}
              run={run}
            />
          </div>
        </div>
      ) : null}

      <DestructiveConfirmDialog
        open={deleteOpen}
        title="Delete this call-out?"
        confirmLabel="Delete call-out"
        cancelLabel="Keep it"
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      >
        It will be removed from On Call, reports and the timeline for everyone. This can&rsquo;t be undone. To close a
        call-out that&rsquo;s been dealt with, resolve it instead.
      </DestructiveConfirmDialog>
    </div>
  );
}

function ActionButtons({
  primary,
  showResolve,
  showCancel,
  busy,
  isPending,
  run,
}: {
  primary: "acknowledge" | "resolve" | null;
  showResolve: boolean;
  showCancel: boolean;
  busy: boolean;
  isPending: (kind: "acknowledge" | "resolve" | "cancel") => boolean;
  run: (kind: "acknowledge" | "resolve" | "cancel") => void;
}) {
  return (
    <>
      {showCancel ? (
        <Button type="button" variant="ghost" className="h-10 min-h-0 px-4" disabled={busy} onClick={() => run("cancel")}>
          {isPending("cancel") ? "Cancelling…" : "Cancel call-out"}
        </Button>
      ) : null}
      {primary === "acknowledge" && showResolve ? (
        <Button type="button" variant="secondary" className="h-10 min-h-0 px-5" disabled={busy} onClick={() => run("resolve")}>
          {isPending("resolve") ? "Resolving…" : "Resolve"}
        </Button>
      ) : null}
      {primary ? (
        <Button type="button" className="h-10 min-h-0 px-5" disabled={busy} onClick={() => run(primary)}>
          {isPending(primary) ? (primary === "acknowledge" ? "Acknowledging…" : "Resolving…") : primary === "acknowledge" ? "Acknowledge" : "Resolve"}
        </Button>
      ) : null}
    </>
  );
}

/** One plain sentence about where this call-out is up to. */
function StatusLine({
  request,
  now,
  canViewResolveTime,
}: {
  request: OnCallDetailRequest;
  now: number;
  canViewResolveTime?: boolean;
}) {
  let text: ReactNode;
  switch (request.status) {
    case "OPEN":
      text = (
        <>
          Waiting for someone to acknowledge. Raised <strong className="font-semibold">{since(request.createdAt, now)}</strong> ago.
        </>
      );
      break;
    case "ACKNOWLEDGED":
      text = (
        <>
          <strong className="font-semibold">{request.responder?.fullName ?? "A colleague"}</strong> acknowledged this
          {request.acknowledgedAt ? ` ${since(request.acknowledgedAt, now)} ago` : ""} and is dealing with it.
        </>
      );
      break;
    case "RESOLVED":
      text =
        canViewResolveTime && request.resolvedAt ? (
          <>
            Resolved {formatWhen(request.resolvedAt)}, {formatDuration(new Date(request.resolvedAt).getTime() - new Date(request.createdAt).getTime())} after it was raised.
          </>
        ) : (
          <>This call-out has been resolved.</>
        );
      break;
    case "CANCELLED":
      text = <>The person who raised this cancelled it.</>;
      break;
  }
  return (
    <p className={styles.statusLine} data-status={request.status} data-emergency={request.isEmergency && (request.status === "OPEN" || request.status === "ACKNOWLEDGED") ? "" : undefined}>
      {text}
    </p>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-[#6e6e73]">{label}</dt>
      <dd className="min-w-0 text-[14px] text-[#1c1c1e]">{children}</dd>
    </div>
  );
}

type TimelineStep = {
  key: string;
  label: string;
  state: "done" | "pending" | "cancelled";
  at?: Date | string | null;
  by?: string | null;
  after?: string | null;
  pendingText?: string;
};

function buildTimeline(request: OnCallDetailRequest): TimelineStep[] {
  const events = [...(request.timelineEvents ?? [])].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  );
  const find = (type: OnCallTimelineEventSerialized["type"]) => events.find((e) => e.type === type);
  const created = find("CREATED");
  const acknowledged = find("ACKNOWLEDGED");
  const resolved = find("RESOLVED");
  const cancelled = find("CANCELLED");
  const raisedAt = new Date(request.createdAt).getTime();

  const steps: TimelineStep[] = [
    {
      key: "raised",
      label: STEP_LABEL.CREATED,
      state: "done",
      at: created?.createdAt ?? request.createdAt,
      by: created?.actor?.fullName ?? request.requester.fullName,
    },
  ];

  if (request.status === "CANCELLED") {
    steps.push({ key: "cancelled", label: STEP_LABEL.CANCELLED, state: "cancelled", at: cancelled?.createdAt, by: cancelled?.actor?.fullName });
    return steps;
  }

  const ackAt = acknowledged?.createdAt ?? request.acknowledgedAt;
  if (ackAt) {
    steps.push({
      key: "acknowledged",
      label: STEP_LABEL.ACKNOWLEDGED,
      state: "done",
      at: ackAt,
      by: acknowledged?.actor?.fullName ?? request.responder?.fullName,
      after: `after ${formatDuration(new Date(ackAt).getTime() - raisedAt)}`,
    });
  } else if (request.status === "OPEN") {
    steps.push({ key: "acknowledged", label: STEP_LABEL.ACKNOWLEDGED, state: "pending", pendingText: "Not yet" });
  }

  if (request.status === "RESOLVED") {
    const resolvedAt = resolved ? resolved.createdAt : request.resolvedAt;
    steps.push({
      key: "resolved",
      label: STEP_LABEL.RESOLVED,
      state: "done",
      at: resolvedAt,
      by: resolved?.actor?.fullName ?? null,
      after: resolvedAt ? `${formatDuration(new Date(resolvedAt).getTime() - raisedAt)} after it was raised` : null,
    });
  } else {
    steps.push({ key: "resolved", label: STEP_LABEL.RESOLVED, state: "pending", pendingText: "Not yet" });
  }
  return steps;
}
