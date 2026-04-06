import { describe, expect, it } from "vitest";
import {
  getSignalsForObservationPhase,
  LESSON_PHASE,
  SIGNAL_KEYS,
} from "../signalDefinitions";

describe("getSignalsForObservationPhase", () => {
  it("returns every signal for UNKNOWN (Not sure)", () => {
    const all = getSignalsForObservationPhase(LESSON_PHASE.UNKNOWN);
    expect(all.length).toBe(17);
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

  it("returns threshold focus signals in order", () => {
    const keys = getSignalsForObservationPhase(LESSON_PHASE.THRESHOLD).map((s) => s.key);
    expect(keys).toEqual([
      SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
      SIGNAL_KEYS.PACE_MOMENTUM,
      SIGNAL_KEYS.RETRIEVAL_PRESENCE,
    ]);
  });
});
