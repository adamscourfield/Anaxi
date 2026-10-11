import { prisma } from "@/lib/prisma";
import { planKs2Backfill, type Ks2Result } from "./ks2PriorAttainment";

/** Tenant-scoped, audited backfill. Recheck nulls in the write to preserve concurrent edits. */
export async function applyKs2Backfill(integrationId: string, actorId: string, results: Ks2Result[]) {
  const integration = await prisma.sharedIntegration.findUniqueOrThrow({
    where: { id: integrationId },
    include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
  });
  const students = await prisma.student.findMany({
    where: { tenantId: { in: integration.schools.map((school) => school.tenantId) }, externalId: { not: null } },
    select: { id: true, tenantId: true, externalId: true, ks2ReadingScaledScore: true, ks2MathsScaledScore: true },
  });
  const plan = planKs2Backfill(students, results);
  const run = await prisma.sharedIntegrationSyncRun.create({
    data: { integrationId, entityType: "ASSESSMENTS", triggeredBy: actorId },
  });
  let updated = 0;
  let scoresUpdated = 0;
  try {
    for (let offset = 0; offset < plan.updates.length; offset += 10) {
      await Promise.all(plan.updates.slice(offset, offset + 10).map(async (update) => {
      const changed = await prisma.$transaction(async (tx) => {
        const data: Record<string, number> = {};
        for (const field of ["ks2ReadingScaledScore", "ks2MathsScaledScore"] as const) {
          const score = update.data[field];
          if (score == null) continue;
          const result = await tx.student.updateMany({
            where: { id: update.student.id, tenantId: update.student.tenantId, externalId: update.student.externalId, [field]: null },
            data: { [field]: score },
          });
          if (result.count) data[field] = score;
        }
        if (!Object.keys(data).length) return 0;
        await tx.sharedIntegrationSyncChange.create({ data: {
          syncRunId: run.id, tenantId: update.student.tenantId, entityType: "StudentKs2PriorAttainment", entityId: update.student.id, changeType: "UPDATE",
          beforeJson: Object.fromEntries(Object.keys(data).map((field) => [field, null])), afterJson: data,
        } });
        return Object.keys(data).length;
      });
      if (changed) { updated++; scoresUpdated += changed; }
      }));
    }
    await prisma.sharedIntegrationSyncRun.update({ where: { id: run.id }, data: {
      status: "SUCCESS", recordsProcessed: results.length, recordsUpdated: updated, finishedAt: new Date(),
    } });
    return { updated, scoresUpdated, conflicts: plan.conflicts, invalid: plan.invalid, preserved: plan.preserved, runId: run.id };
  } catch (error) {
    await prisma.sharedIntegrationSyncRun.update({ where: { id: run.id }, data: {
      status: updated ? "PARTIAL" : "FAILED", recordsProcessed: results.length, recordsUpdated: updated, recordsFailed: 1,
      errorSummary: "KS2 backfill did not complete. Retry to fill the remaining missing scores.", finishedAt: new Date(),
    } });
    throw error;
  }
}
