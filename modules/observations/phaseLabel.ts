import type { PillVariant } from "@/components/ui/status-pill";

const PHASE_LABELS: Record<string, string> = {
  INSTRUCTION: "Instruction",
  GUIDED_PRACTICE: "Guided Practice",
  INDEPENDENT_PRACTICE: "Independent Practice",
  UNKNOWN: "Not Recorded",
  THRESHOLD: "Threshold",
  TRANSITION_START: "Transition / start",
  BOOKS: "Book Look",
};

const PHASE_VARIANTS: Record<string, PillVariant> = {
  INSTRUCTION: "info",
  GUIDED_PRACTICE: "success",
  INDEPENDENT_PRACTICE: "accent",
  UNKNOWN: "neutral",
  THRESHOLD: "warning",
  TRANSITION_START: "warning",
  BOOKS: "neutral",
};

export function formatPhaseLabel(phase: string): string {
  if (PHASE_LABELS[phase]) return PHASE_LABELS[phase];
  return phase
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function phaseVariant(phase: string): PillVariant {
  return PHASE_VARIANTS[phase] ?? "neutral";
}
