import { describe, expect, it } from "vitest";
import {
  approvedStatusFilter,
  isApprovedStatus,
  isPendingStatus,
  loaStatusUiBucket,
  normalizeLoaStatus,
} from "@/lib/leaveStatus";

describe("leaveStatus", () => {
  it("normalises legacy APPROVED", () => {
    expect(normalizeLoaStatus("APPROVED")).toBe("APPROVED_WITH_PAY");
  });

  it("detects approved variants", () => {
    expect(isApprovedStatus("APPROVED_WITH_PAY")).toBe(true);
    expect(isApprovedStatus("APPROVED_WITHOUT_PAY")).toBe(true);
    expect(isApprovedStatus("APPROVED")).toBe(true);
    expect(isApprovedStatus("PENDING")).toBe(false);
  });

  it("maps UI buckets", () => {
    expect(loaStatusUiBucket("APPROVED_WITHOUT_PAY")).toBe("APPROVED");
    expect(loaStatusUiBucket("DENIED")).toBe("DENIED");
    expect(loaStatusUiBucket("CANCELLED")).toBe("CANCELLED");
    expect(isPendingStatus("PENDING")).toBe(true);
  });

  it("includes legacy in approved filter", () => {
    expect(approvedStatusFilter()).toContain("APPROVED");
    expect(approvedStatusFilter()).toContain("APPROVED_WITH_PAY");
  });
});
