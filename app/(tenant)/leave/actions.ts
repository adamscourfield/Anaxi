"use server";

import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createLoaRequest(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");

  const startDate = new Date(String(formData.get("startAt") || ""));
  const endDate = new Date(String(formData.get("endAt") || ""));
  const reasonId = String(formData.get("reasonId") || "");
  const reasonText = String(formData.get("reasonText") || "").trim() || null;
  const coverRequirements = String(formData.get("coverRequirements") || "").trim() || null;
  const medicalEvidenceUrl = String(formData.get("medicalEvidenceUrl") || "").trim() || null;
  const notes = String(formData.get("coverNotes") || "").trim() || null;

  if (!reasonId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error("INVALID_REQUEST");
  }

  const reason = await prisma.loaReason.findFirst({ where: { id: reasonId, tenantId: user.tenantId, active: true } });
  if (!reason) throw new Error("INVALID_REASON");

  await (prisma as any).lOARequest.create({
    data: {
      tenantId: user.tenantId,
      requesterId: user.id,
      startDate,
      endDate,
      reasonId,
      reasonText,
      coverRequirements,
      medicalEvidenceUrl,
      notes,
      status: "PENDING"
    }
  });

  revalidatePath("/leave");
  revalidatePath("/leave/calendar");
  revalidatePath("/leave/pending");
  redirect("/leave?created=1");
}

export async function decideLoaRequest(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const requestId = String(formData.get("requestId") || "");
  const decisionType = String(formData.get("decisionType") || "");
  const decisionNotes = String(formData.get("decisionNotes") || "").trim();

  const request = await (prisma as any).lOARequest.findFirst({ where: { id: requestId, tenantId: user.tenantId } });
  if (!request) throw new Error("NOT_FOUND");
  if (request.requesterId === user.id) throw new Error("CANNOT_APPROVE_OWN_LOA");
  const canManage = await canManageLoa(user, request.requesterId);
  if (!canManage) throw new Error("FORBIDDEN");
  if (request.status !== "PENDING") throw new Error("ALREADY_DECIDED");

  const VALID_DECISIONS = ["APPROVED_WITH_PAY", "APPROVED_WITHOUT_PAY", "DENIED"] as const;
  type Decision = (typeof VALID_DECISIONS)[number];
  if (!VALID_DECISIONS.includes(decisionType as Decision)) throw new Error("INVALID_DECISION");
  const status = decisionType as Decision;

  const auditComment = decisionNotes
    ? `[Decision ${status} by ${user.fullName} on ${new Date().toLocaleString("en-GB")}] ${decisionNotes}`
    : null;

  await (prisma as any).lOARequest.update({
    where: { id: requestId },
    data: {
      status,
      notes: auditComment
        ? [request.notes, auditComment].filter(Boolean).join("\n\n")
        : request.notes,
    }
  });

  revalidatePath(`/leave/${requestId}`);
  revalidatePath("/leave/calendar");
  revalidatePath("/leave/pending");
  redirect(`/leave/${requestId}`);
}
