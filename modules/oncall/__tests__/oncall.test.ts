import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasOnCallPermission } from "@/lib/rbac";
import {
  createOnCallRequest,
  acknowledgeOnCallRequest,
  resolveOnCallRequest,
  cancelOnCallRequest,
} from "@/modules/oncall/service";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findFirst: vi.fn() },
    onCallRequest: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
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

  it("ON_CALL role can acknowledge, resolve, and view all", () => {
    expect(hasOnCallPermission("ON_CALL", "oncall:acknowledge")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:resolve")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:view_all")).toBe(true);
    expect(hasOnCallPermission("ON_CALL", "oncall:create")).toBe(false);
  });

  it("HR can create only", () => {
    expect(hasOnCallPermission("HR", "oncall:create")).toBe(true);
    expect(hasOnCallPermission("HR", "oncall:acknowledge")).toBe(false);
  });

  it("SLT can create, acknowledge, resolve, and view all", () => {
    expect(hasOnCallPermission("SLT", "oncall:create")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:acknowledge")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:resolve")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:view_all")).toBe(true);
    expect(hasOnCallPermission("SLT", "oncall:cancel")).toBe(false);
  });
});

describe("createOnCallRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).student.findFirst.mockResolvedValue(mockStudent);
    (prisma as any).onCallRequest.create.mockResolvedValue(mockRequest());
  });

  it("creates a request successfully", async () => {
    const result = await createOnCallRequest("tenant_1", "user_1", {
      studentId: "student_1",
      requestType: "BEHAVIOUR",
      location: "Hallway",
      behaviourReasonCategory: "Disruption",
    });
    expect(result.status).toBe("OPEN");
    expect((prisma as any).onCallRequest.create).toHaveBeenCalledOnce();
    expect((prisma as any).onCallRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isEmergency: false }),
      })
    );
  });

  it("persists isEmergency when true", async () => {
    await createOnCallRequest("tenant_1", "user_1", {
      studentId: "student_1",
      requestType: "FIRST_AID",
      location: "Hallway",
      isEmergency: true,
    });
    expect((prisma as any).onCallRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isEmergency: true }),
      })
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
    (prisma as any).onCallRequest.create.mockResolvedValue(mockRequest({ requestType: "FIRST_AID" }));
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
    (prisma as any).onCallRequest.findFirst
      .mockResolvedValueOnce(mockRequest())
      .mockResolvedValueOnce(mockRequest({ status: "ACKNOWLEDGED", responderUserId: "responder_1" }));
    (prisma as any).onCallRequest.updateMany.mockResolvedValue({ count: 1 });
  });

  it("acknowledges an OPEN request", async () => {
    const result = await acknowledgeOnCallRequest("req_1", "tenant_1", "responder_1");
    expect(result.status).toBe("ACKNOWLEDGED");
    expect((prisma as any).onCallRequest.updateMany).toHaveBeenCalledOnce();
  });

  it("throws when request is not OPEN", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "RESOLVED" }));
    (prisma as any).onCallRequest.updateMany.mockResolvedValue({ count: 0 });
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
    (prisma as any).onCallRequest.findFirst
      .mockResolvedValueOnce(mockRequest({ status: "ACKNOWLEDGED" }))
      .mockResolvedValueOnce(mockRequest({ status: "RESOLVED", resolvedAt: new Date() }));
    (prisma as any).onCallRequest.updateMany.mockResolvedValue({ count: 1 });
  });

  it("resolves an ACKNOWLEDGED request", async () => {
    const result = await resolveOnCallRequest("req_1", "tenant_1", "responder_1");
    expect(result.status).toBe("RESOLVED");
  });

  it("throws when request already resolved", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "RESOLVED" }));
    (prisma as any).onCallRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      resolveOnCallRequest("req_1", "tenant_1", "responder_1")
    ).rejects.toThrow("request already resolved");
  });

  it("throws when request is cancelled", async () => {
    (prisma as any).onCallRequest.findFirst.mockReset();
    (prisma as any).onCallRequest.findFirst.mockResolvedValue(mockRequest({ status: "CANCELLED" }));
    (prisma as any).onCallRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      resolveOnCallRequest("req_1", "tenant_1", "responder_1")
    ).rejects.toThrow("request is cancelled");
  });
});

describe("cancelOnCallRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).onCallRequest.findFirst
      .mockResolvedValueOnce(mockRequest())
      .mockResolvedValueOnce(mockRequest({ status: "CANCELLED" }));
    (prisma as any).onCallRequest.updateMany.mockResolvedValue({ count: 1 });
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
    (prisma as any).onCallRequest.updateMany.mockResolvedValue({ count: 0 });
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
