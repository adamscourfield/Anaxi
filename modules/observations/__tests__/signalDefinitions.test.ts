import { describe, expect, it } from "vitest";
import { getSignalsForPhase } from "../getSignalsBySchoolType";
import {
  CLASSROOM_ONLY_SIGNAL_DEFINITIONS,
  getSignalsForObservationPhase,
  LESSON_PHASE,
  SIGNAL_KEYS,
} from "../signalDefinitions";

describe("getSignalsForObservationPhase", () => {
  it("returns classroom-only signals for UNKNOWN (Not sure), excluding book look", () => {
    const all = getSignalsForObservationPhase(LESSON_PHASE.UNKNOWN);
    expect(all.length).toBe(CLASSROOM_ONLY_SIGNAL_DEFINITIONS.length);
    expect(all.every((s) => !s.phases.includes(LESSON_PHASE.BOOKS))).toBe(true);
  });

  it("returns only book signals for BOOKS", () => {
    const keys = getSignalsForObservationPhase(LESSON_PHASE.BOOKS).map((s) => s.key);
    expect(keys).toEqual([
      SIGNAL_KEYS.PRESENTATION_STANDARD,
      SIGNAL_KEYS.WORK_COMPLETION,
      SIGNAL_KEYS.SUSTAINED_EFFORT,
      SIGNAL_KEYS.TASK_APPROPRIATENESS,
      SIGNAL_KEYS.VOLUME_OF_WORK,
    ]);
  });

  it("returns INSTRUCTION: 2 universal + 5 phase-specific", () => {
    const keys = getSignalsForObservationPhase(LESSON_PHASE.INSTRUCTION).map((s) => s.key);
    expect(keys).toHaveLength(7);
    expect(keys).toEqual([
      SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
      SIGNAL_KEYS.PACE_MOMENTUM,
      SIGNAL_KEYS.EXPLANATION_CLARITY,
      SIGNAL_KEYS.MODELLING_EXPLICITNESS,
      SIGNAL_KEYS.VOCABULARY_PRECISION,
      SIGNAL_KEYS.DIRECTED_QUESTIONING,
      SIGNAL_KEYS.STRETCH_IN_ROOM,
    ]);
  });

  it("returns threshold signals in order", () => {
    const keys = getSignalsForObservationPhase(LESSON_PHASE.THRESHOLD).map((s) => s.key);
    expect(keys).toEqual([
      SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
      SIGNAL_KEYS.PACE_MOMENTUM,
      SIGNAL_KEYS.ENTRY_ROUTINE,
      SIGNAL_KEYS.RETRIEVAL_TASK_QUALITY,
      SIGNAL_KEYS.RETRIEVAL_CHECK,
    ]);
  });
});

describe("getSignalsForPhase (school type routing)", () => {
  it("INSTRUCTION SECONDARY: 2 universal + 5 phase-specific", () => {
    expect(getSignalsForPhase("INSTRUCTION", "SECONDARY")).toHaveLength(7);
  });
  it("INSTRUCTION PRIMARY: 2 universal + 5 phase-specific", () => {
    expect(getSignalsForPhase("INSTRUCTION", "PRIMARY")).toHaveLength(7);
  });
  it("BOOKS SECONDARY: 5 book signals, no universals", () => {
    const defs = getSignalsForPhase("BOOKS", "SECONDARY");
    expect(defs).toHaveLength(5);
    expect(defs.every((s) => !s.isUniversal)).toBe(true);
  });
  it("UNKNOWN SECONDARY: all classroom signals, no book signals", () => {
    const defs = getSignalsForPhase("UNKNOWN", "SECONDARY");
    expect(defs.length).toBe(CLASSROOM_ONLY_SIGNAL_DEFINITIONS.length);
    expect(defs.every((s) => !s.phases.includes(LESSON_PHASE.BOOKS))).toBe(true);
  });
});
