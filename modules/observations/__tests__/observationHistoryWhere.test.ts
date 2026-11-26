import { describe, expect, it } from "vitest";
import { buildObservationHistoryWhere } from "@/modules/observations/observationHistoryWhere";

const base = {
  tenantId: "t1",
  userId: "me",
  teacherId: "",
  subject: "",
  yearGroup: "",
  observerId: "",
  from: "",
  to: "",
  phaseFilter: "",
  signalKeyFilter: "",
  useWindow: false,
  windowStart: null,
  hodVisibleUserIds: new Set<string>(),
  coacheeUserIds: [] as string[],
};

describe("observation history scope", () => {
  it("teachers see observations of them and ones they recorded", () => {
    const { where } = buildObservationHistoryWhere({ ...base, userRole: "TEACHER" });
    expect(where.OR).toEqual([{ observedTeacherId: "me" }, { observerId: "me" }]);
  });

  it("teachers can narrow to either side", () => {
    expect(buildObservationHistoryWhere({ ...base, userRole: "TEACHER", scope: "of" }).where).toMatchObject({ observedTeacherId: "me" });
    const by = buildObservationHistoryWhere({ ...base, userRole: "TEACHER", scope: "by" }).where;
    expect(by).toMatchObject({ observerId: "me" });
    expect(by.observedTeacherId).toBeUndefined();
  });

  it("a teacher filtering by a colleague only gets the ones they recorded", () => {
    const { where } = buildObservationHistoryWhere({ ...base, userRole: "TEACHER", teacherId: "colleague" });
    expect(where).toMatchObject({ observedTeacherId: "colleague", observerId: "me" });
    expect(where.OR).toBeUndefined();
  });

  it("heads of department see their team plus anything they recorded", () => {
    const { where } = buildObservationHistoryWhere({
      ...base,
      userRole: "LEADER",
      hodVisibleUserIds: new Set(["a", "b"]),
    });
    expect(where.OR).toEqual([{ observedTeacherId: { in: ["a", "b", "me"] } }, { observerId: "me" }]);
  });

  it("a leader filtering outside their team only gets the ones they recorded", () => {
    const { where } = buildObservationHistoryWhere({
      ...base,
      userRole: "LEADER",
      hodVisibleUserIds: new Set(["a"]),
      teacherId: "z",
    });
    expect(where).toMatchObject({ observedTeacherId: "z", observerId: "me" });
  });

  it("senior leaders are unchanged", () => {
    const { where } = buildObservationHistoryWhere({ ...base, userRole: "SLT" });
    expect(where.OR).toBeUndefined();
    expect(where.observedTeacherId).toBeUndefined();
  });
});
