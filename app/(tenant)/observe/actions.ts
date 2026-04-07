"use server";

import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createObservation(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  requireRole(user, ["LEADER", "SLT", "ADMIN"]);

  const observedTeacherId = String(formData.get("observedTeacherId") || "");
  const observedAt = new Date(String(formData.get("observedAt") || ""));
  const yearGroup = String(formData.get("yearGroup") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const classCode = String(formData.get("classCode") || "").trim() || null;
  const phase = String(formData.get("phase") || "UNKNOWN");
  const contextNote = String(formData.get("contextNote") || "").trim() || null;

  if (!observedTeacherId || !yearGroup || !subject || Number.isNaN(observedAt.getTime())) {
    throw new Error("INVALID_OBSERVATION");
  }

  const teacher = await (prisma as any).user.findFirst({ where: { id: observedTeacherId, tenantId: user.tenantId, isActive: true } });
  if (!teacher) throw new Error("INVALID_TEACHER");

  const schoolType = await getTenantSchoolType(user.tenantId);
  const phaseSignals = getSignalsForPhase(phase, schoolType);
  const signalData = phaseSignals.map((signal) => {
    const allowedScaleKeys = new Set(signal.scale.map((s) => s.key));
    const notObserved = String(formData.get(`signal_${signal.key}_not`) || "") === "1";
    const valueKey = String(formData.get(`signal_${signal.key}_value`) || "").trim() || null;
    if (!notObserved && (!valueKey || !allowedScaleKeys.has(valueKey as any))) {
      throw new Error(`MISSING_SIGNAL_${signal.key}`);
    }
    return {
      signalKey: signal.key,
      valueKey: notObserved ? null : valueKey,
      notObserved
    };
  });

  const observation = await (prisma as any).observation.create({
    data: {
      tenantId: user.tenantId,
      observedTeacherId,
      observerId: user.id,
      observedAt,
      yearGroup,
      subject,
      classCode,
      phase,
      contextNote,
      signals: { createMany: { data: signalData } }
    }
  });

  revalidatePath("/observe/history");
  redirect(`/observe/${observation.id}`);
}

export async function submitObservationDraft(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  requireRole(user, ["LEADER", "SLT", "ADMIN"]);

  const observedTeacherId = String(formData.get("observedTeacherId") || "").trim();
  const yearGroup = String(formData.get("yearGroup") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const classCode = String(formData.get("classCode") || "").trim() || null;
  const phase = String(formData.get("phase") || "UNKNOWN");
  const contextNote = String(formData.get("contextNote") || "").trim() || null;
  const observedAtRaw = String(formData.get("observedAt") || "").trim();

  if (!observedTeacherId || !yearGroup || !subject) throw new Error("INVALID_OBSERVATION");

  const teacher = await (prisma as any).user.findFirst({ where: { id: observedTeacherId, tenantId: user.tenantId, isActive: true } });
  if (!teacher) throw new Error("INVALID_TEACHER");

  const schoolType = await getTenantSchoolType(user.tenantId);
  const phaseSignals = getSignalsForPhase(phase, schoolType);
  const signalData = phaseSignals.map((signal) => {
    const allowedScaleKeys = new Set(signal.scale.map((s) => s.key));
    const notObserved = String(formData.get(`signal_${signal.key}_not`) || "") === "1";
    const valueKey = String(formData.get(`signal_${signal.key}_value`) || "").trim() || null;
    if (!notObserved && (!valueKey || !allowedScaleKeys.has(valueKey as any))) {
      throw new Error(`MISSING_SIGNAL_${signal.key}`);
    }
    return {
      signalKey: signal.key,
      valueKey: notObserved ? null : valueKey,
      notObserved
    };
  });

  const observation = await (prisma as any).observation.create({
    data: {
      tenantId: user.tenantId,
      observedTeacherId,
      observerId: user.id,
      observedAt: observedAtRaw ? new Date(observedAtRaw) : new Date(),
      yearGroup,
      subject,
      classCode,
      phase,
      contextNote,
      signals: { createMany: { data: signalData } }
    }
  });

  revalidatePath("/observe/history");
  redirect(`/observe/${observation.id}`);
}
