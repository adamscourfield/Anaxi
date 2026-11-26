"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { revalidatePath } from "next/cache";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canManageStrategy, parseStrategyPriority, STRATEGY_LIMITS } from "@/modules/strategy/access";

export type StrategyActionResult = { ok: true } | { ok: false; error: string };

async function manager() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STRATEGY");
  if (!canManageStrategy(user.role)) return null;
  return user;
}

const NO_ACCESS: StrategyActionResult = { ok: false, error: "You can't change the Strategy Board." };
const GONE: StrategyActionResult = { ok: false, error: "That strategy no longer exists. Refresh the page." };

function text(formData: FormData, key: string, max: number): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function areaData(formData: FormData) {
  return {
    title: text(formData, "title", STRATEGY_LIMITS.title),
    category: text(formData, "category", STRATEGY_LIMITS.target),
    description: text(formData, "description", STRATEGY_LIMITS.description),
    owner: text(formData, "owner", STRATEGY_LIMITS.lead),
  };
}

// ─── Areas ────────────────────────────────────────────────────────────────────

export async function createStrategyArea(formData: FormData): Promise<StrategyActionResult> {
  await assertSafeServerAction(formData);
  const user = await manager();
  if (!user) return NO_ACCESS;
  const data = areaData(formData);
  if (!data.title) return { ok: false, error: "Give the strategy a name." };

  await (prisma as any).strategyArea.create({
    data: {
      ...data,
      title: data.title,
      tenantId: user.tenantId,
      createdById: user.id,
      priority: parseStrategyPriority(formData.get("priority")),
    },
  });
  revalidatePath("/strategy");
  return { ok: true };
}

export async function updateStrategyArea(id: string, formData: FormData): Promise<StrategyActionResult> {
  await assertSafeServerAction(formData);
  const user = await manager();
  if (!user) return NO_ACCESS;
  const existing = await (prisma as any).strategyArea.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return GONE;
  const data = areaData(formData);
  if (!data.title) return { ok: false, error: "Give the strategy a name." };

  await (prisma as any).strategyArea.update({
    where: { id },
    data: { ...data, title: data.title, priority: parseStrategyPriority(formData.get("priority"), existing.priority) },
  });
  revalidatePath("/strategy");
  return { ok: true };
}

export async function toggleStrategyAreaComplete(id: string): Promise<StrategyActionResult> {
  await assertSafeServerAction();
  const user = await manager();
  if (!user) return NO_ACCESS;
  const existing = await (prisma as any).strategyArea.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return GONE;
  await (prisma as any).strategyArea.update({ where: { id }, data: { completed: !existing.completed } });
  revalidatePath("/strategy");
  return { ok: true };
}

export async function deleteStrategyArea(id: string): Promise<StrategyActionResult> {
  await assertSafeServerAction();
  const user = await manager();
  if (!user) return NO_ACCESS;
  await (prisma as any).strategyArea.deleteMany({ where: { id, tenantId: user.tenantId } });
  revalidatePath("/strategy");
  return { ok: true };
}

// ─── Actions (stored as notes) ────────────────────────────────────────────────

export async function createStrategyNote(areaId: string, rawText: string): Promise<StrategyActionResult> {
  await assertSafeServerAction();
  const user = await manager();
  if (!user) return NO_ACCESS;
  const note = String(rawText ?? "").trim().slice(0, STRATEGY_LIMITS.action);
  if (!note) return { ok: false, error: "Write the action first." };
  const area = await (prisma as any).strategyArea.findFirst({ where: { id: areaId, tenantId: user.tenantId } });
  if (!area) return GONE;

  await (prisma as any).strategyNote.create({
    data: { strategyAreaId: areaId, tenantId: user.tenantId, createdById: user.id, text: note },
  });
  revalidatePath("/strategy");
  return { ok: true };
}

export async function deleteStrategyNote(noteId: string): Promise<StrategyActionResult> {
  await assertSafeServerAction();
  const user = await manager();
  if (!user) return NO_ACCESS;
  await (prisma as any).strategyNote.deleteMany({ where: { id: noteId, tenantId: user.tenantId } });
  revalidatePath("/strategy");
  return { ok: true };
}
