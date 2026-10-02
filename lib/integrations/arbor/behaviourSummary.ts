import type { ArborBehaviourRecords } from "./client";

export type BehaviourTotals = {
  positivePoints: number;
  detentions: number;
  internalExclusions: number;
  suspensions: number;
};

/** Maps Arbor's four behaviour sources to the behaviour totals Anaxi already uses. */
export function summariseBehaviour(records: ArborBehaviourRecords, linkedExternalIds: Set<string>) {
  const byStudent = new Map<string, BehaviourTotals>();
  let unmatched = 0;
  const add = (externalId: string, update: Partial<BehaviourTotals>) => {
    if (!linkedExternalIds.has(externalId)) { unmatched++; return; }
    const current = byStudent.get(externalId) ?? { positivePoints: 0, detentions: 0, internalExclusions: 0, suspensions: 0 };
    byStudent.set(externalId, {
      positivePoints: current.positivePoints + (update.positivePoints ?? 0),
      detentions: current.detentions + (update.detentions ?? 0),
      internalExclusions: current.internalExclusions + (update.internalExclusions ?? 0),
      suspensions: current.suspensions + (update.suspensions ?? 0),
    });
  };
  for (const item of records.PointAward) add(item.student.id, { positivePoints: Math.max(0, Math.round(item.points)) });
  for (const item of records.Detention) add(item.student.id, { detentions: 1 });
  for (const item of records.InternalExclusion) add(item.student.id, { internalExclusions: 1 });
  for (const item of records.FixedPeriodExclusion) add(item.student.id, { suspensions: 1 });
  return { byStudent, unmatched };
}
