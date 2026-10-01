import { describe, expect, it } from "vitest";

import {
  ARBOR_STAFF_FIELD_OWNERSHIP_MESSAGE,
  assertCanEditArborOwnedStaffFields,
  getBlockedArborOwnedStaffFields,
} from "@/lib/integrations/arbor/fieldOwnership";

const arborStaffUser = {
  dataSource: "ARBOR",
  fullName: "Ada Lovelace",
  role: "TEACHER",
};

describe("Arbor field ownership", () => {
  it("blocks changes to Arbor-owned staff fields", () => {
    expect(getBlockedArborOwnedStaffFields(arborStaffUser, { fullName: "Ada Byron" })).toEqual([
      "fullName",
    ]);
    expect(getBlockedArborOwnedStaffFields(arborStaffUser, { role: "ADMIN" })).toEqual([]);
  });

  it("allows no-op saves for Arbor-owned staff fields", () => {
    expect(
      getBlockedArborOwnedStaffFields(arborStaffUser, {
        fullName: "Ada Lovelace",
        role: "TEACHER",
      }),
    ).toEqual([]);
  });

  it("allows manual records to be edited", () => {
    expect(
      getBlockedArborOwnedStaffFields(
        { ...arborStaffUser, dataSource: "MANUAL" },
        { fullName: "Ada Byron", role: "ADMIN" },
      ),
    ).toEqual([]);
  });

  it("throws a user-facing error for blocked edits", () => {
    expect(() =>
      assertCanEditArborOwnedStaffFields(arborStaffUser, { fullName: "Ada Byron" }),
    ).toThrow(ARBOR_STAFF_FIELD_OWNERSHIP_MESSAGE);
  });
});
