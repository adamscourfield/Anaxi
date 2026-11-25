import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasPermission } from "@/lib/rbac";
import {
  createAction,
  getActionDetail,
  completeAction,
  blockAction,
  updateActionStatus,
  getMyActions,
  getOverdueActions,
  calculateDaysUntilDue,
  isActionOverdue,
} from "@/modules/actions/service";
import { daysUntilDue, dueBucket, formatDue, isPastDue } from "@/modules/actions/dates";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    meeting: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    meetingAction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const now = new Date("2026-01-15T10:00:00Z");

const mockMeeting = { id: "meeting_1", tenantId: "tenant_1", title: "Sync" };
const mockOwner = { id: "user_1", tenantId: "tenant_1", fullName: "Alice", email: "alice@test.com", isActive: true };

const mockAction = (overrides: Record<string, unknown> = {}) => ({
  id: "action_1",
  tenantId: "tenant_1",
  meetingId: "meeting_1",
  description: "Fix the bug",
  ownerUserId: "user_1",
  owner: { id: "user_1", fullName: "Alice", email: "alice@test.com" },
  dueDate: new Date("2026-01-20T00:00:00Z"),
  status: "OPEN",
  createdByUserId: "user_1",
  createdBy: { id: "user_1", fullName: "Alice", email: "alice@test.com" },
  completedAt: null,
  completedByUserId: null,
  completedBy: null,
  meeting: mockMeeting,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("RBAC – action permissions", () => {
  it("ADMIN has all action permissions", () => {
    expect(hasPermission("ADMIN", "actions:create")).toBe(true);
    expect(hasPermission("ADMIN", "actions:manage")).toBe(true);
    expect(hasPermission("ADMIN", "actions:view_own")).toBe(true);
    expect(hasPermission("ADMIN", "actions:view_all")).toBe(true);
  });

  it("SLT can view all action items for oversight, without meeting notes access", () => {
    expect(hasPermission("SLT", "actions:view_all")).toBe(true);
    expect(hasPermission("SLT", "meetings:view_all")).toBe(false);
  });

  it("TEACHER has create, manage, view_own but not view_all", () => {
    expect(hasPermission("TEACHER", "actions:create")).toBe(true);
    expect(hasPermission("TEACHER", "actions:manage")).toBe(true);
    expect(hasPermission("TEACHER", "actions:view_own")).toBe(true);
    expect(hasPermission("TEACHER", "actions:view_all")).toBe(false);
  });

  it("HR can only view_own", () => {
    expect(hasPermission("HR", "actions:create")).toBe(false);
    expect(hasPermission("HR", "actions:manage")).toBe(false);
    expect(hasPermission("HR", "actions:view_own")).toBe(true);
  });

  it("ON_CALL can only view_own", () => {
    expect(hasPermission("ON_CALL", "actions:view_own")).toBe(true);
    expect(hasPermission("ON_CALL", "actions:create")).toBe(false);
    expect(hasPermission("ON_CALL", "actions:manage")).toBe(false);
  });
});

describe("calculateDaysUntilDue", () => {
  it("returns positive for future date", () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(calculateDaysUntilDue(future)).toBeGreaterThan(0);
  });

  it("returns negative for past date", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(calculateDaysUntilDue(past)).toBeLessThan(0);
  });
});

describe("due dates are UK calendar days", () => {
  it("an action due today is not overdue, even late in the evening", () => {
    const due = new Date("2026-06-10T00:00:00Z");
    expect(isPastDue(due, new Date("2026-06-10T22:30:00Z"))).toBe(false);
    expect(daysUntilDue(due, new Date("2026-06-10T22:30:00Z"))).toBe(0);
  });

  it("becomes overdue the next UK day", () => {
    const due = new Date("2026-06-10T00:00:00Z");
    // 23:30 UTC on the 10th is 00:30 on the 11th in London (BST).
    expect(isPastDue(due, new Date("2026-06-10T23:30:00Z"))).toBe(true);
  });

  it("labels and buckets", () => {
    const now = new Date("2026-11-25T11:00:00Z");
    expect(formatDue(new Date("2026-11-25T00:00:00Z"), now)).toBe("Due today");
    expect(formatDue(new Date("2026-11-26T00:00:00Z"), now)).toBe("Due tomorrow");
    expect(formatDue(new Date("2026-11-22T00:00:00Z"), now)).toBe("3 days overdue");
    expect(dueBucket(new Date("2026-11-30T00:00:00Z"), now)).toBe("week");
    expect(dueBucket(new Date("2026-12-30T00:00:00Z"), now)).toBe("later");
    expect(dueBucket(null, now)).toBe("none");
  });
});

describe("isActionOverdue", () => {
  it("returns true for past due date", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isActionOverdue(past)).toBe(true);
  });

  it("returns false for future due date", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isActionOverdue(future)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isActionOverdue(null)).toBe(false);
    expect(isActionOverdue(undefined)).toBe(false);
  });
});

describe("createAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meeting.findFirst.mockResolvedValue(mockMeeting);
    (prisma as any).user.findFirst.mockResolvedValue(mockOwner);
    (prisma as any).meetingAction.create.mockResolvedValue(mockAction());
  });

  it("creates an action successfully", async () => {
    const result = await createAction("tenant_1", "meeting_1", "user_1", {
      description: "Fix the bug",
      ownerUserId: "user_1",
    });
    expect(result.status).toBe("OPEN");
    expect(result.description).toBe("Fix the bug");
    expect((prisma as any).meetingAction.create).toHaveBeenCalledOnce();
  });

  it("throws when description missing", async () => {
    await expect(
      createAction("tenant_1", "meeting_1", "user_1", { description: "", ownerUserId: "user_1" })
    ).rejects.toThrow("description required");
  });

  it("throws when ownerUserId missing", async () => {
    await expect(
      createAction("tenant_1", "meeting_1", "user_1", { description: "Something", ownerUserId: "" })
    ).rejects.toThrow("ownerUserId required");
  });

  it("throws when meeting not found (multi-tenant isolation)", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(null);
    await expect(
      createAction("tenant_2", "meeting_1", "user_1", { description: "Task", ownerUserId: "user_1" })
    ).rejects.toThrow("meeting not found");
  });

  it("throws when owner not found in tenant", async () => {
    (prisma as any).user.findFirst.mockResolvedValue(null);
    await expect(
      createAction("tenant_1", "meeting_1", "user_1", { description: "Task", ownerUserId: "unknown" })
    ).rejects.toThrow("owner user not found");
  });
});

describe("completeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meetingAction.findFirst.mockResolvedValue(mockAction());
    (prisma as any).meetingAction.update.mockResolvedValue(
      mockAction({ status: "DONE", completedAt: now, completedByUserId: "user_1" })
    );
  });

  it("marks action as DONE", async () => {
    const result = await completeAction("tenant_1", "action_1", "user_1");
    expect(result.status).toBe("DONE");
    expect(result.completedAt).toBeTruthy();
  });

  it("throws when non-owner tries to complete", async () => {
    await expect(
      completeAction("tenant_1", "action_1", "other_user")
    ).rejects.toThrow("only owner can complete action");
  });

  it("throws when action not found", async () => {
    (prisma as any).meetingAction.findFirst.mockResolvedValue(null);
    await expect(
      completeAction("tenant_1", "nonexistent", "user_1")
    ).rejects.toThrow("action not found");
  });

  it("enforces tenant isolation", async () => {
    (prisma as any).meetingAction.findFirst.mockResolvedValue(null);
    await expect(
      completeAction("tenant_2", "action_1", "user_1")
    ).rejects.toThrow("action not found");
    expect((prisma as any).meetingAction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant_2" }) })
    );
  });
});

describe("blockAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meetingAction.findFirst.mockResolvedValue(mockAction());
    (prisma as any).meetingAction.update.mockResolvedValue(mockAction({ status: "BLOCKED" }));
  });

  it("marks action as BLOCKED and stores blockReason", async () => {
    const result = await blockAction("tenant_1", "action_1", "user_1", "waiting on IT");
    expect(result.status).toBe("BLOCKED");
    const updateCall = (prisma as any).meetingAction.update.mock.calls[0][0];
    expect(updateCall.data.blockReason).toBe("waiting on IT");
  });

  it("throws when non-owner tries to block", async () => {
    await expect(
      blockAction("tenant_1", "action_1", "other_user", "reason")
    ).rejects.toThrow("only owner can block action");
  });

  it("requires a reason", async () => {
    await expect(blockAction("tenant_1", "action_1", "user_1", "   ")).rejects.toThrow("reason required");
  });
});

describe("updateActionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meetingAction.findFirst.mockResolvedValue(mockAction());
    (prisma as any).meetingAction.update.mockResolvedValue(mockAction({ status: "DONE" }));
  });

  it("updates status", async () => {
    const result = await updateActionStatus("tenant_1", "action_1", "user_1", { status: "DONE" });
    expect(result.status).toBe("DONE");
  });

  it("throws when non-owner tries to update", async () => {
    await expect(
      updateActionStatus("tenant_1", "action_1", "other_user", { status: "DONE" })
    ).rejects.toThrow("only owner can update action status");
  });

  it("rejects unknown statuses", async () => {
    await expect(updateActionStatus("tenant_1", "action_1", "user_1", { status: "NOPE" as any })).rejects.toThrow("Invalid status");
  });

  it("reopening clears the block reason and completion", async () => {
    (prisma as any).meetingAction.update.mockResolvedValue(mockAction({ status: "OPEN" }));
    await updateActionStatus("tenant_1", "action_1", "user_1", { status: "OPEN" });
    const data = (prisma as any).meetingAction.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "OPEN", blockReason: null, completedAt: null, completedByUserId: null });
  });
});

describe("getMyActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const overdue = mockAction({ id: "a1", dueDate: new Date(Date.now() - 2 * 86400000), status: "OPEN" });
    const open = mockAction({ id: "a2", dueDate: new Date(Date.now() + 5 * 86400000), status: "OPEN" });
    const done = mockAction({ id: "a3", status: "DONE" });
    (prisma as any).meetingAction.findMany.mockResolvedValueOnce([overdue, open]).mockResolvedValueOnce([done]);
    (prisma as any).meetingAction.count.mockResolvedValue(1);
  });

  it("returns grouped actions", async () => {
    const grouped = await getMyActions("tenant_1", "user_1");
    expect(grouped.OPEN).toHaveLength(2);
    expect(grouped.DONE).toHaveLength(1);
    expect(grouped.BLOCKED).toHaveLength(0);
    expect(grouped.doneTotal).toBe(1);
  });

  it("flags overdue actions", async () => {
    const grouped = await getMyActions("tenant_1", "user_1");
    const overdueAction = grouped.OPEN.find((a: any) => a.id === "a1");
    expect(overdueAction?.isOverdue).toBe(true);
  });
});

describe("getOverdueActions", () => {
  it("returns count of overdue open actions", async () => {
    (prisma as any).meetingAction.count.mockResolvedValue(3);
    const count = await getOverdueActions("tenant_1", "user_1");
    expect(count).toBe(3);
    expect((prisma as any).meetingAction.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["OPEN", "BLOCKED"] }, ownerUserId: "user_1" }),
      })
    );
  });
});
