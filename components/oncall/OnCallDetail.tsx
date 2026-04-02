"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnCallStatusBadge } from "./OnCallStatusBadge";
import { H3, MetaText } from "@/components/ui/typography";
import { REQUEST_TYPE_LABELS } from "@/modules/oncall/types";
import { StatusPill } from "@/components/ui/status-pill";

interface OnCallDetailRequest {
  id: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  requestType: "BEHAVIOUR" | "FIRST_AID";
  isEmergency?: boolean;
  student: { fullName: string; upn: string; yearGroup?: string | null };
  location: string;
  behaviourReasonCategory?: string | null;
  notes?: string | null;
  requester: { fullName: string };
  responder?: { fullName: string } | null;
  createdAt: Date | string;
  acknowledgedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  requesterUserId?: string;
}

interface OnCallDetailProps {
  request: OnCallDetailRequest;
  canAcknowledge?: boolean;
  canResolve?: boolean;
  canCancel?: boolean;
}

function fmt(d?: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
    </>
  );
}

export function OnCallDetail({ request, canAcknowledge, canResolve, canCancel }: OnCallDetailProps) {
  const router = useRouter();
  const [actionPending, setActionPending] = useState<string | null>(null);

  const showActions =
    (canAcknowledge && request.status === "OPEN") ||
    (canResolve && (request.status === "OPEN" || request.status === "ACKNOWLEDGED")) ||
    (canCancel && request.status === "OPEN");

  async function handleAction(action: "acknowledge" | "resolve" | "cancel") {
    setActionPending(action);
    try {
      const res = await fetch(`/api/oncall/${request.id}/${action}`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setActionPending(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6 md:max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <OnCallStatusBadge status={request.status} />
        <StatusPill variant="neutral" size="sm">{REQUEST_TYPE_LABELS[request.requestType]}</StatusPill>
        {request.isEmergency && (
          <StatusPill variant="error" size="sm">Emergency</StatusPill>
        )}
      </div>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <MetaText className="mb-0.5 font-medium">Student</MetaText>
            <p className="text-text">{request.student.fullName} ({request.student.upn})</p>
          </div>
          <div>
            <MetaText className="mb-0.5 font-medium">Year Group</MetaText>
            <p className="text-text">{request.student.yearGroup ?? "\u2014"}</p>
          </div>
          <div>
            <MetaText className="mb-0.5 font-medium">Location</MetaText>
            <p className="text-text">{request.location}</p>
          </div>
          {request.behaviourReasonCategory && (
            <div>
              <MetaText className="mb-0.5 font-medium">Reason</MetaText>
              <p className="text-text">{request.behaviourReasonCategory}</p>
            </div>
          )}
          {request.notes && (
            <div className="sm:col-span-2">
              <MetaText className="mb-0.5 font-medium">Notes</MetaText>
              <p className="text-text">{request.notes}</p>
            </div>
          )}
          <div>
            <MetaText className="mb-0.5 font-medium">Raised by</MetaText>
            <p className="text-text">{request.requester.fullName}</p>
          </div>
          {request.responder && (
            <div>
              <MetaText className="mb-0.5 font-medium">Responder</MetaText>
              <p className="text-text">{request.responder.fullName}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        <H3>Timeline</H3>
        <ol className="space-y-3 border-l-2 border-accent/20 pl-4">
          <li className="space-y-0.5">
            <p className="text-xs font-semibold text-text">Created</p>
            <MetaText>{fmt(request.createdAt)}</MetaText>
          </li>
          {request.acknowledgedAt && (
            <li className="space-y-0.5">
              <p className="text-xs font-semibold text-text">Acknowledged</p>
              <MetaText>
                {fmt(request.acknowledgedAt)}
                {request.responder ? ` by ${request.responder.fullName}` : ""}
              </MetaText>
            </li>
          )}
          {request.resolvedAt && (
            <li className="space-y-0.5">
              <p className="text-xs font-semibold text-text">Resolved</p>
              <MetaText>
                {fmt(request.resolvedAt)}
                {request.responder ? ` by ${request.responder.fullName}` : ""}
              </MetaText>
            </li>
          )}
        </ol>
      </div>

      <div className="flex flex-wrap gap-3">
        {canAcknowledge && request.status === "OPEN" && (
          <form method="POST" action={`/api/oncall/${request.id}/acknowledge`}>
            <Button type="submit">Acknowledge</Button>
          </form>
        )}
        {canResolve && (request.status === "OPEN" || request.status === "ACKNOWLEDGED") && (
          <form method="POST" action={`/api/oncall/${request.id}/resolve`}>
            <Button type="submit" variant="secondary">Resolve</Button>
          </form>
        )}
        {canCancel && request.status === "OPEN" && (
          <form method="POST" action={`/api/oncall/${request.id}/cancel`}>
            <Button type="submit" variant="ghost">Cancel request</Button>
          </form>
        )}
      </div>

      <Link href="/on-call" className="calm-transition inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent">
        &larr; Back to on call inbox
      </Link>
    </div>
  );
}
