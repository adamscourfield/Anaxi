import { describe, expect, it } from "vitest";
import { requireAssessmentWrite } from "@/lib/guards";
import type { SessionUser } from "@/lib/types";

const user = (role: SessionUser["role"]): SessionUser => ({
  id: "u1",
  tenantId: "t1",
  email: "a@test.com",
  fullName: "A",
  role,
  isActive: true,
});

describe("requireAssessmentWrite", () => {
  it("allows ADMIN, SLT, SUPER_ADMIN", () => {
    expect(() => requireAssessmentWrite(user("ADMIN"))).not.toThrow();
    expect(() => requireAssessmentWrite(user("SLT"))).not.toThrow();
    expect(() => requireAssessmentWrite(user("SUPER_ADMIN"))).not.toThrow();
  });

  it("rejects TEACHER", () => {
    expect(() => requireAssessmentWrite(user("TEACHER"))).toThrow("FORBIDDEN");
  });
});
