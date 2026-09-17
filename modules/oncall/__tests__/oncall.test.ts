import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasOnCallPermission } from "@/lib/rbac";
import {
  createOnCallRequest,
  acknowledgeOnCallRequest,
  resolveOnCallRequest,
  cancelOnCallRequest,
  deleteOnCallRequest,
  getOpenAndAcknowledgedRequests,
  getResolvedRequests,
  getTodayActivity,
} from "@/modules/oncall/service";
import { parseResolvedHistoryRange, resolvedHistoryRangeStart } from "@/modules/oncall/types";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findFirst: vi.fn() },
    $transaction: vi.fn(),
    onCallRequest: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    onCallTimelineEvent: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockStudent = { id: "student_1", tenantId: "tenant_1", fullName: "Ada Lovelace" };
const mockRequest = (overrides: Record<string, unknown> = {}) => ({
  id: "req_1",
  tenantId: "tenant_1",
  requesterUserId: "user_1",
  studentId: "student_1",
  requestType: "BEHAVIOUR",
  isEmergency: false,
  location: "Hallway",
  behaviourReasonCategory: "Disruption",
  notes: null,
  status: "OPEN",
  responderUserId: null,
  student: mockStudent,
  requester: { id: "user_1", fullName: "Alice", email: "alice@school.test" },
  responder: null,
  ...overrides,
});

describe("RBAC – hasOnCallPermission", () => {
  it("ADMIN has all oncall permissions", () => {
    expect(hasOnCallPermission("ADMIN", "oncall:create")).toBe(true);
    expect(hasOnCallPermission("ADMIN", "oncall:acknowledge")).toBe(true);
    expect(hasOnCallPermission("ADMIN", "oncall:resolve")).toBe(true);
    expect(hasOnCallPermission("ADMIN", "oncall:view_all")).toBe(true);
    expect(hasOnCallPermission("ADMIN", "oncall:cancel")).toBe(true);
  });

  it("TEACHER can create and cancel", () => {
    expect(hasOnCallPermission("TEACHER", "oncall:create")).toBe(true);
    expect(hasOnCallPermission("TEACHER", "oncall:cancel")).toBe(true);
    expect(hasOnCallPermission("TEACHER", "oncall:acknowledge")).toBe(false);
    expect(hasOnCallPermission("TEACHER", "oncall:resolve")).toBe(false);
    expect(hasOnCallPermission("TEACHER", "oncall:view_all")).toBe(false);
  });

  it("ON_CALL role can create, acknowledge, resolve, view all, and cancel their own", () => {
    expect(hasOnCallPermission("ON_CALL", "oncall:create")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:acknowledge")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:resolve")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:view_all")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:cancel")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:delete")).toBe(false);
  });

  it("HR can create only", () => {
    expect(hasOnCallPermission("HR", "oncall:create")).toBe(true);
    expect(hasOnCallPermission("HR", "oncall:acknowledge")).toBe(false);
  });

  it("SLT can create, acknowledge, resolve, view all, and delete", () => {
    expect(hasOnCallPermission("SLT", "oncall:create")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:acknowledge")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:resolve")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:view_all")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:cancel")).toBe(false);
    expect(hasOnCallPermission("SLT", "oncall:delete")).toBe(true);
  });

  it("TEACHER cannot delete", () => {
    expect(hasOnCallPermission("TEACHER", "oncall:delete")).toBe(false);
  });
});

describe("createOnCallRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).student.findFirst.mockResolvedValue(mockStudent);
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          create: vi.fn().mockResolvedValue({
            id: "req_1",
            tenantId: "tenant_1",
            requesterUserId: "user_1",
            studentId: "student_1",
            status: "OPEN",
          }),
          findFirst: vi.fn().mockResolvedValue(mockRequest()),
        },
        onCallTimelineEvent: {
          create: vi.fn().mockResolvedValue({}),
        },
      }),
    );
  });

  it("creates a request successfully", async () => {
    const result = await createOnCallRequest("tenant_1", "user_1", {
      studentId: "student_1",
      requestType: "BEHAVIOUR",
      location: "Hallway",
      behaviourReasonCategory: "Disruption",
    });
    expect(result.status).toBe("OPEN");
    expect((prisma as any).$transaction).toHaveBeenCalledOnce();
  });

  it("persists isEmergency when true", async () => {
    let capturedCreate: unknown;
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = {
        onCallRequest: {
          create: vi.fn().mockImplementation((args: unknown) => {
            capturedCreate = args;
            return Promise.resolve({
              id: "req_1",
              tenantId: "tenant_1",
              requesterUserId: "user_1",
              studentId: "student_1",
              status: "OPEN",
            });
          }),
          findFirst: vi.fn().mockResolvedValue(mockRequest({ requestType: "FIRST_AID", isEmergency: true })),
        },
        onCallTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    await createOnCallRequest("tenant_1", "user_1", {
      studentId: "student_1",
      requestType: "FIRST_AID",
      location: "Hallway",
      isEmergency: true,
    });
    expect(capturedCreate).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ isEmergency: true }),
      }),
    );
  });

  it("throws when behaviourReasonCategory missing for BEHAVIOUR type", async () => {
    await expect(
      createOnCallRequest("tenant_1", "user_1", {
        studentId: "student_1",
        requestType: "BEHAVIOUR",
        location: "Hallway",
      })
    ).rejects.toThrow("behaviourReasonCategory required for BEHAVIOUR type");
  });

  it("throws when studentId missing", async () => {
    await expect(
      createOnCallRequest("tenant_1", "user_1", {
        studentId: "",
        requestType: "FIRST_AID",
        location: "Office",
      })
    ).rejects.toThrow("studentId required");
  });

  it("throws when location missing", async () => {
    await expect(
      createOnCallRequest("tenant_1", "user_1", {
        studentId: "student_1",
        requestType: "FIRST_AID",
        location: "",
      })
    ).rejects.toThrow("location required");
  });

  it("throws when student not found in tenant (multi-tenant isolation)", async () => {
    (prisma as any).student.findFirst.mockResolvedValue(null);
    await expect(
      createOnCallRequest("tenant_2", "user_1", {
        studentId: "student_1",
        requestType: "FIRST_AID",
        location: "Office",
      })
    ).rejects.toThrow("student not found");
  });

  it("does not require behaviourReasonCategory for FIRST_AID", async () => {
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          create: vi.fn().mockResolvedValue({
            id: "req_1",
            tenantId: "tenant_1",
            requesterUserId: "user_1",
            studentId: "student_1",
            status: "OPEN",
          }),
          findFirst: vi.fn().mockResolvedValue(mockRequest({ requestType: "FIRST_AID" })),
        },
        onCallTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
    const result = await createOnCallRequest("tenant_1", "user_1", {
      studentId: "student_1",
      requestType: "FIRST_AID",
      location: "Reception",
    });
    expect(result.requestType).toBe("FIRST_AID");
  });
});

describe("acknowledgeOnCallRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest());
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(mockRequest({ status: "ACKNOWLEDGED", responderUserId: "responder_1" })),
        },
        onCallTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it("acknowledges an OPEN request", async () => {
    const result = await acknowledgeOnCallRequest("req_1", "tenant_1", "responder_1");
    expect(result.status).toBe("ACKNOWLEDGED");
    expect((prisma as any).$transaction).toHaveBeenCalledOnce();
  });

  it("throws when request is not OPEN", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "RESOLVED" }));
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn(),
        },
        onCallTimelineEvent: { create: vi.fn() },
      }),
    );
    await expect(
      acknowledgeOnCallRequest("req_1", "tenant_1", "responder_1")
    ).rejects.toThrow("request is not OPEN");
  });

  it("throws when request not found", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(null);
    await expect(
      acknowledgeOnCallRequest("req_1", "tenant_1", "responder_1")
    ).rejects.toThrow("request not found");
  });
});

describe("resolveOnCallRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "ACKNOWLEDGED" }));
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(mockRequest({ status: "RESOLVED", resolvedAt: new Date() })),
        },
        onCallTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it("resolves an ACKNOWLEDGED request", async () => {
    const result = await resolveOnCallRequest("req_1", "tenant_1", "responder_1");
    expect(result.status).toBe("RESOLVED");
  });

  it("throws when request already resolved", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "RESOLVED" }));
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn(),
        },
        onCallTimelineEvent: { create: vi.fn() },
      }),
    );
    await expect(
      resolveOnCallRequest("req_1", "tenant_1", "responder_1")
    ).rejects.toThrow("request already resolved");
  });

  it("throws when request is cancelled", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "CANCELLED" }));
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn(),
        },
        onCallTimelineEvent: { create: vi.fn() },
      }),
    );
    await expect(
      resolveOnCallRequest("req_1", "tenant_1", "responder_1")
    ).rejects.toThrow("request is cancelled");
  });
});

describe("cancelOnCallRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest());
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(mockRequest({ status: "CANCELLED" })),
        },
        onCallTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it("cancels an OPEN request by the requester", async () => {
    const result = await cancelOnCallRequest("req_1", "tenant_1", "user_1");
    expect(result.status).toBe("CANCELLED");
  });

  it("throws when non-requester tries to cancel", async () => {
    await expect(
      cancelOnCallRequest("req_1", "tenant_1", "other_user")
    ).rejects.toThrow("only the requester can cancel");
  });

  it("throws when request is not OPEN", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "ACKNOWLEDGED" }));
    (prisma as any).$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        onCallRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn(),
        },
        onCallTimelineEvent: { create: vi.fn() },
      }),
    );
    await expect(
      cancelOnCallRequest("req_1", "tenant_1", "user_1")
    ).rejects.toThrow("only OPEN requests can be cancelled");
  });

  it("throws when request not found", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(null);
    await expect(
      cancelOnCallRequest("req_1", "tenant_1", "user_1")
    ).rejects.toThrow("request not found");
  });
});

describe("deleteOnCallRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a request scoped to the tenant", async () => {
    (prisma as any).onCallRequest.deleteMany.mockResolvedValue({ count: 1 });
    await deleteOnCallRequest("req_1", "tenant_1");
    expect((prisma as any).onCallRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: "req_1", tenantId: "tenant_1" },
    });
  });

  it("throws when request not found (or belongs to a different tenant)", async () => {
    (prisma as any).onCallRequest.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteOnCallRequest("req_1", "tenant_1")).rejects.toThrow("request not found");
  });
});

describe("getOpenAndAcknowledgedRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries only OPEN and ACKNOWLEDGED requests, scoped to the tenant, with no date limit", async () => {
    (prisma as any).onCallRequest.findMany.mockResolvedValue([mockRequest()]);
    await getOpenAndAcknowledgedRequests("tenant_1");
    expect((prisma as any).onCallRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant_1", status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      })
    );
  });

  it("adds a nested student.yearGroup filter when yearGroup is provided", async () => {
    (prisma as any).onCallRequest.findMany.mockResolvedValue([]);
    await getOpenAndAcknowledgedRequests("tenant_1", { yearGroup: "10" });
    expect((prisma as any).onCallRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant_1",
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          student: { yearGroup: "10" },
        },
      })
    );
  });

  it("adds a behaviourReasonCategory filter when reasonCategory is provided", async () => {
    (prisma as any).onCallRequest.findMany.mockResolvedValue([]);
    await getOpenAndAcknowledgedRequests("tenant_1", { reasonCategory: "Disruption" });
    expect((prisma as any).onCallRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant_1",
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          behaviourReasonCategory: "Disruption",
        },
      })
    );
  });
});

describe("getResolvedRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries RESOLVED requests with no lower bound when resolvedAfter is omitted", async () => {
    (prisma as any).onCallRequest.findMany.mockResolvedValue([]);
    await getResolvedRequests("tenant_1");
    expect((prisma as any).onCallRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant_1", status: "RESOLVED" } })
    );
  });

  it("scopes to resolvedAt >= resolvedAfter when provided", async () => {
    (prisma as any).onCallRequest.findMany.mockResolvedValue([]);
    const after = new Date("2026-01-01T00:00:00Z");
    await getResolvedRequests("tenant_1", after);
    expect((prisma as any).onCallRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant_1", status: "RESOLVED", resolvedAt: { gte: after } },
      })
    );
  });

  it("combines resolvedAfter with yearGroup and reasonCategory filters", async () => {
    (prisma as any).onCallRequest.findMany.mockResolvedValue([]);
    const after = new Date("2026-01-01T00:00:00Z");
    await getResolvedRequests("tenant_1", after, { yearGroup: "13", reasonCategory: "Refusal" });
    expect((prisma as any).onCallRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant_1",
          status: "RESOLVED",
          resolvedAt: { gte: after },
          student: { yearGroup: "13" },
          behaviourReasonCategory: "Refusal",
        },
      })
    );
  });
});

describe("getTodayActivity", () => {
  it("queries by createdAt >= todayStart, scoped to the tenant", async () => {
    (prisma as any).onCallRequest.findMany.mockResolvedValue([]);
    const todayStart = new Date("2026-01-15T00:00:00Z");
    await getTodayActivity("tenant_1", todayStart);
    expect((prisma as any).onCallRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant_1", createdAt: { gte: todayStart } },
      })
    );
  });
});

describe("resolved history range helpers", () => {
  it("parses known range values and falls back to today", () => {
    expect(parseResolvedHistoryRange("7d")).toBe("7d");
    expect(parseResolvedHistoryRange("30d")).toBe("30d");
    expect(parseResolvedHistoryRange("all")).toBe("all");
    expect(parseResolvedHistoryRange(undefined)).toBe("today");
    expect(parseResolvedHistoryRange("bogus")).toBe("today");
  });

  it("computes a start boundary for today/7d/30d and null (no bound) for all", () => {
    const now = new Date("2026-03-15T10:00:00");
    const today = resolvedHistoryRangeStart("today", now);
    expect(today?.getHours()).toBe(0);
    expect(today?.getDate()).toBe(15);

    const sevenDays = resolvedHistoryRangeStart("7d", now);
    expect(sevenDays?.getDate()).toBe(8);

    const thirtyDays = resolvedHistoryRangeStart("30d", now);
    expect(thirtyDays?.getMonth()).toBe(1); // February

    expect(resolvedHistoryRangeStart("all", now)).toBeNull();
  });
});
