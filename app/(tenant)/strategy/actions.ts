"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { revalidatePath } from "next/cache";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = "critical" | "high" | "medium" | "low";

// ─── Guards ───────────────────────────────────────────────────────────────────

/**
 * Only ADMIN and SLT roles can manage strategy areas.
 * Adjust role names to match your User.role enum.
 */
function canManageStrategy(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "SLT", "HEAD_TEACHER"].includes(role);
}

// ─── Areas ────────────────────────────────────────────────────────────────────

export async function createStrategyArea(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  if (!canManageStrategy(user.role)) throw new Error("Unauthorised");

  const title = formData.get("title") as string;
  if (!title?.trim()) throw new Error("Title is required");

  const rawDescription = ((formData.get("description") as string) ?? "").trim();
  const description = rawDescription ? rawDescription.slice(0, 1000) : null;

  await (prisma as any).strategyArea.create({
    data: {
      tenantId:    user.tenantId,
      createdById: user.id,
      title:       title.trim(),
      category:    ((formData.get("category") as string) ?? "").trim() || null,
      description,
      priority:    (formData.get("priority") as Priority) ?? "medium",
      owner:       ((formData.get("owner") as string) ?? "").trim() || null,
    },
  });

  revalidatePath("/strategy");
}

export async function updateStrategyArea(id: string, formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  if (!canManageStrategy(user.role)) throw new Error("Unauthorised");

  // Ensure the area belongs to this tenant
  const existing = await (prisma as any).strategyArea.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!existing) throw new Error("Not found");

  const title = formData.get("title") as string;
  if (!title?.trim()) throw new Error("Title is required");

  const rawDescription = ((formData.get("description") as string) ?? "").trim();
  const description = rawDescription ? rawDescription.slice(0, 1000) : null;

  await (prisma as any).strategyArea.update({
    where: { id },
    data: {
      title:       title.trim(),
      category:    ((formData.get("category") as string) ?? "").trim() || null,
      description,
      priority:    (formData.get("priority") as Priority) ?? existing.priority,
      owner:       ((formData.get("owner") as string) ?? "").trim() || null,
    },
  });

  revalidatePath("/strategy");
}

export async function toggleStrategyAreaComplete(id: string) {
  await assertSafeServerAction();
  const user = await getSessionUserOrThrow();
  if (!canManageStrategy(user.role)) throw new Error("Unauthorised");

  const existing = await (prisma as any).strategyArea.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!existing) throw new Error("Not found");

  await (prisma as any).strategyArea.update({
    where: { id },
    data: { completed: !existing.completed },
  });

  revalidatePath("/strategy");
}

export async function deleteStrategyArea(id: string) {
  await assertSafeServerAction();
  const user = await getSessionUserOrThrow();
  if (!canManageStrategy(user.role)) throw new Error("Unauthorised");

  await (prisma as any).strategyArea.deleteMany({
    where: { id, tenantId: user.tenantId },
  });

  revalidatePath("/strategy");
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function createStrategyNote(areaId: string, text: string) {
  await assertSafeServerAction();
  const user = await getSessionUserOrThrow();
  if (!canManageStrategy(user.role)) throw new Error("Unauthorised");

  // Verify area belongs to this tenant
  const area = await (prisma as any).strategyArea.findFirst({
    where: { id: areaId, tenantId: user.tenantId },
  });
  if (!area) throw new Error("Not found");

  await (prisma as any).strategyNote.create({
    data: {
      strategyAreaId: areaId,
      tenantId:       user.tenantId,
      createdById:    user.id,
      text:           text.trim(),
    },
  });

  revalidatePath("/strategy");
}

export async function deleteStrategyNote(noteId: string) {
  await assertSafeServerAction();
  const user = await getSessionUserOrThrow();
  if (!canManageStrategy(user.role)) throw new Error("Unauthorised");

  await (prisma as any).strategyNote.deleteMany({
    where: { id: noteId, tenantId: user.tenantId },
  });

  revalidatePath("/strategy");
}
