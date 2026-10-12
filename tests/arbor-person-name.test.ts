import { describe, expect, it } from "vitest";
import { arborPersonName } from "../lib/integrations/arbor/personName";

describe("Arbor person names", () => {
  it("imports staff with empty preferred names using their legal name", () => {
    expect(arborPersonName({ preferredFirstName: "", preferredLastName: "", legalFirstName: "Sean", legalLastName: "Yakes" })).toBe("Sean Yakes");
  });
  it("falls back independently for whitespace-only name components", () => {
    expect(arborPersonName({ preferredFirstName: "  ", preferredLastName: " Khan ", legalFirstName: " Adam ", legalLastName: "Smith" })).toBe("Adam Khan");
  });
  it("preserves a valid preferred name", () => {
    expect(arborPersonName({ preferredFirstName: " Sam ", preferredLastName: null, legalFirstName: "Samuel", legalLastName: " Jones " })).toBe("Sam Jones");
  });
});
