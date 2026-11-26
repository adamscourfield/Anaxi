import { prisma } from "@/lib/prisma";

export type AttainmentCycleOption = { id: string; label: string; hasResults: boolean };

const ELIGIBLE = ["VALIDATED", "PUBLISHED", "LOCKED"] as const;

/**
 * The assessment cycles a school can analyse, and the one to show.
 *
 * Every attainment insight page uses this so they all agree: the requested cycle when it
 * exists, otherwise the first cycle (by name) that has results. Without it, a page opened
 * with no cycle in the URL silently combined every cycle while its header named only one.
 */
export async function resolveAttainmentCycle(
  tenantId: string,
  requested: string | null | undefined,
): Promise<{ cycles: AttainmentCycleOption[]; selected: AttainmentCycleOption | null }> {
  const rows = await prisma.assessmentCycle.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      label: true,
      points: { where: { resultStatus: { in: [...ELIGIBLE] } }, select: { id: true }, take: 1 },
    },
    orderBy: { label: "asc" },
  });
  const cycles = rows.map((c) => ({ id: c.id, label: c.label, hasResults: c.points.length > 0 }));
  return { cycles, selected: pickAttainmentCycle(cycles, requested) };
}

export function pickAttainmentCycle(
  cycles: AttainmentCycleOption[],
  requested: string | null | undefined,
): AttainmentCycleOption | null {
  return (
    cycles.find((c) => c.id === requested) ??
    cycles.find((c) => c.hasResults) ??
    cycles[0] ??
    null
  );
}
