import { getSignalsForObservationPhase, SIGNAL_DEFINITIONS } from "./signalDefinitions";
import { getSignalsForObservationPhasePrimary, PRIMARY_SIGNAL_DEFINITIONS } from "./signalDefinitionsPrimary";
import type { SignalDefinition } from "./signalTypes";

export type SchoolTypeRouting = "PRIMARY" | "SECONDARY";

export function getSignalsForPhase(phase: string, schoolType: SchoolTypeRouting) {
  return schoolType === "PRIMARY" ? getSignalsForObservationPhasePrimary(phase) : getSignalsForObservationPhase(phase);
}

/** Definitions for UI, seeds, and analysis: primary set or secondary active (non-deprecated) signals. */
export function getSignalDefinitionsForSchoolType(schoolType: SchoolTypeRouting): SignalDefinition[] {
  return schoolType === "PRIMARY"
    ? PRIMARY_SIGNAL_DEFINITIONS
    : SIGNAL_DEFINITIONS.filter((d) => !d.deprecated);
}

/** Admin / onboarding: all distinct keys (secondary includes deprecated for legacy label rows). */
export function getAllSignalDefinitionsForTenantLabels(): SignalDefinition[] {
  const byKey = new Map<string, SignalDefinition>();
  for (const d of SIGNAL_DEFINITIONS) byKey.set(d.key, d);
  for (const d of PRIMARY_SIGNAL_DEFINITIONS) {
    if (!byKey.has(d.key)) byKey.set(d.key, d);
  }
  return [...byKey.values()].sort((a, b) => a.order - b.order);
}

export function findSignalDefinitionForSchoolType(
  signalKey: string,
  schoolType: SchoolTypeRouting
): SignalDefinition | undefined {
  return getSignalDefinitionsForSchoolType(schoolType).find((d) => d.key === signalKey);
}
