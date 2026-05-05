import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasPermission } from "@/lib/rbac";
import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetingDetail,
  addAttendee,
  removeAttendee,
} from "@/modules/meetings/service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    meeting: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    meetingAttendee: {
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const now = new Date("2026-01-15T10:00:00Z");
const later = new Date("2026-01-15T11:00:00Z");

const mockMeeting = (overrides: Record<string, unknown> = {}) => ({
  id: "meeting_1",
  tenantId: "tenant_1",
  title: "Weekly Sync",
  type: "DEPARTMENT",
  startDateTime: now,
  endDateTime: later,
  location: null,
  notes: null,
  createdByUserId: "user_1",
  createdBy: { id: "user_1", fullName: "Alice", email: "alice@school.test" },
  attendees: [
    { id: "att_1", userId: "user_1", user: { id: "user_1", fullName: "Alice", email: "alice@school.test" } },
  ],
  actions: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("RBAC – meetings permissions", () => {
  it("ADMIN has all meeting permissions", () => {
    expect(hasPermission("ADMIN", "meetings:create")).toBe(true);
    expect(hasPermission("ADMIN", "meetings:view_own")).toBe(true);
    expect(hasPermission("ADMIN", "meetings:view_all")).toBe(true);
    expect(hasPermission("ADMIN", "meetings:edit")).toBe(true);
    expect(hasPermission("ADMIN", "meetings:delete")).toBe(true);
  });

  it("TEACHER can create and view own", () => {
    expect(hasPermission("TEACHER", "meetings:create")).toBe(true);
    expect(hasPermission("TEACHER", "meetings:view_own")).toBe(true);
    expect(hasPermission("TEACHER", "meetings:view_all")).toBe(false);
    expect(hasPermission("TEACHER", "meetings:edit")).toBe(false);
  });

  it("SLT can view all", () => {
    expect(hasPermission("SLT", "meetings:view_all")).toBe(true);
    expect(hasPermission("SLT", "meetings:create")).toBe(true);
  });

  it("HR can create and view own but not all", () => {
    expect(hasPermission("HR", "meetings:create")).toBe(true);
    expect(hasPermission("HR", "meetings:view_own")).toBe(true);
    expect(hasPermission("HR", "meetings:view_all")).toBe(false);
  });

  it("ON_CALL can only view own", () => {
    expect(hasPermission("ON_CALL", "meetings:view_own")).toBe(true);
    expect(hasPermission("ON_CALL", "meetings:create")).toBe(false);
  });
});

describe("createMeeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).user.findMany.mockResolvedValue([{ id: "user_1" }]);
    (prisma as any).meeting.create.mockResolvedValue(mockMeeting());
  });

  it("creates a meeting successfully", async () => {
    const result = await createMeeting("tenant_1", "user_1", {
      title: "Weekly Sync",
      type: "DEPARTMENT",
      startDateTime: now,
      endDateTime: later,
      attendeeIds: [],
    });
    expect(result.title).toBe("Weekly Sync");
    expect((prisma as any).meeting.create).toHaveBeenCalledOnce();
  });

  it("throws when title missing", async () => {
    await expect(
      createMeeting("tenant_1", "user_1", {
        title: "",
        type: "OTHER",
        startDateTime: now,
        endDateTime: later,
        attendeeIds: [],
      })
    ).rejects.toThrow("title required");
  });

  it("throws when endDateTime is before startDateTime", async () => {
    await expect(
      createMeeting("tenant_1", "user_1", {
        title: "Test",
        type: "OTHER",
        startDateTime: later,
        endDateTime: now,
        attendeeIds: [],
      })
    ).rejects.toThrow("endDateTime must be after startDateTime");
  });

  it("creator is always added as attendee", async () => {
    await createMeeting("tenant_1", "user_1", {
      title: "Test",
      type: "OTHER",
      startDateTime: now,
      endDateTime: later,
      attendeeIds: ["user_2"],
    });
    const createCall = (prisma as any).meeting.create.mock.calls[0][0];
    expect(createCall.data.attendees.createMany.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: "user_1" })])
    );
  });

  it("persists startedAt when provided", async () => {
    await createMeeting("tenant_1", "user_1", {
      title: "Test",
      type: "OTHER",
      startDateTime: now,
      endDateTime: later,
      attendeeIds: [],
      startedAt: now,
    });
    const createCall = (prisma as any).meeting.create.mock.calls[0][0];
    expect(createCall.data.startedAt).toEqual(now);
  });
});

describe("getMeetingDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meeting.findFirst.mockResolvedValue(mockMeeting());
  });

  it("returns meeting detail", async () => {
    const result = await getMeetingDetail("tenant_1", "meeting_1");
    expect(result.id).toBe("meeting_1");
  });

  it("throws when meeting not found", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(null);
    await expect(getMeetingDetail("tenant_1", "nonexistent")).rejects.toThrow("meeting not found");
  });

  it("enforces tenant isolation", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(null);
    await expect(getMeetingDetail("tenant_2", "meeting_1")).rejects.toThrow("meeting not found");
    expect((prisma as any).meeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant_2" }) })
    );
  });
});

describe("updateMeeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meeting.findFirst.mockResolvedValue(mockMeeting());
    (prisma as any).meeting.update.mockResolvedValue(mockMeeting({ title: "Updated" }));
  });

  it("updates title successfully", async () => {
    const result = await updateMeeting("tenant_1", "meeting_1", "user_1", { title: "Updated" });
    expect(result.title).toBe("Updated");
  });

  it("throws when non-creator tries to update", async () => {
    await expect(
      updateMeeting("tenant_1", "meeting_1", "other_user", { title: "X" })
    ).rejects.toThrow("only creator can update meeting");
  });

  it("throws when meeting not found", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(null);
    await expect(
      updateMeeting("tenant_1", "nonexistent", "user_1", {})
    ).rejects.toThrow("meeting not found");
  });

  it("sets startedAt when meeting has not started", async () => {
    await updateMeeting("tenant_1", "meeting_1", "user_1", { startedAt: now });
    const updateCall = (prisma as any).meeting.update.mock.calls[0][0];
    expect(updateCall.data.startedAt).toEqual(now);
  });

  it("throws when setting startedAt on already-started meeting", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(
      mockMeeting({ startedAt: new Date("2026-01-15T09:00:00Z") }),
    );
    await expect(
      updateMeeting("tenant_1", "meeting_1", "user_1", { startedAt: now }),
    ).rejects.toThrow("meeting already started");
  });

  it("throws when setting startedAt on cancelled meeting", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(mockMeeting({ status: "CANCELLED" }));
    await expect(
      updateMeeting("tenant_1", "meeting_1", "user_1", { startedAt: now }),
    ).rejects.toThrow("cannot start a cancelled meeting");
  });

  it("sets endedAt and syncs endDateTime after session started", async () => {
    const started = new Date("2026-01-15T09:00:00Z");
    const ended = new Date("2026-01-15T09:45:00Z");
    (prisma as any).meeting.findFirst.mockResolvedValue(
      mockMeeting({ startedAt: started, status: "CONFIRMED", endedAt: null }),
    );
    await updateMeeting("tenant_1", "meeting_1", "user_1", { endedAt: ended });
    const updateCall = (prisma as any).meeting.update.mock.calls[0][0];
    expect(updateCall.data.endedAt).toEqual(ended);
    expect(updateCall.data.endDateTime).toEqual(ended);
  });

  it("throws when ending before start", async () => {
    const started = new Date("2026-01-15T10:00:00Z");
    const ended = new Date("2026-01-15T09:00:00Z");
    (prisma as any).meeting.findFirst.mockResolvedValue(
      mockMeeting({ startedAt: started, status: "CONFIRMED", endedAt: null }),
    );
    await expect(
      updateMeeting("tenant_1", "meeting_1", "user_1", { endedAt: ended }),
    ).rejects.toThrow("endedAt must be after startedAt");
  });

  it("throws when ending meeting that never started", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(mockMeeting({ startedAt: null }));
    await expect(
      updateMeeting("tenant_1", "meeting_1", "user_1", { endedAt: later }),
    ).rejects.toThrow("cannot end meeting before it has been started");
  });
});

describe("deleteMeeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meeting.findFirst.mockResolvedValue(mockMeeting());
    (prisma as any).meeting.delete.mockResolvedValue({});
  });

  it("deletes meeting for creator", async () => {
    await deleteMeeting("tenant_1", "meeting_1", "user_1");
    expect((prisma as any).meeting.delete).toHaveBeenCalledOnce();
  });

  it("throws when non-creator tries to delete", async () => {
    await expect(
      deleteMeeting("tenant_1", "meeting_1", "other_user")
    ).rejects.toThrow("only creator can delete meeting");
  });
});

describe("addAttendee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).meeting.findFirst.mockResolvedValue(mockMeeting());
    (prisma as any).meetingAttendee.upsert.mockResolvedValue({ id: "att_2", meetingId: "meeting_1", userId: "user_2" });
  });

  it("adds attendee successfully", async () => {
    const result = await addAttendee("meeting_1", "user_2", "tenant_1");
    expect(result.userId).toBe("user_2");
  });

  it("throws when meeting not found", async () => {
    (prisma as any).meeting.findFirst.mockResolvedValue(null);
    await expect(addAttendee("nonexistent", "user_2", "tenant_1")).rejects.toThrow("meeting not found");
  });
});
