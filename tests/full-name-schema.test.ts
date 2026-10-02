import { describe, expect, it } from "vitest";
import { fullNameSchema } from "@/lib/validation/schemas";

describe("fullNameSchema", () => {
  it("trims and collapses internal whitespace", () => {
    expect(fullNameSchema.parse("  Ada   Lovelace ")).toBe("Ada Lovelace");
  });

  it("rejects blank names", () => {
    const result = fullNameSchema.safeParse("   ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Name is required.");
  });

  it("rejects names over 120 characters", () => {
    expect(fullNameSchema.safeParse("a".repeat(121)).success).toBe(false);
    expect(fullNameSchema.safeParse("a".repeat(120)).success).toBe(true);
  });
});
