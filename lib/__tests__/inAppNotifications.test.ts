import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inAppNotification: {
      create: vi.fn().mockResolvedValue({ id: "n1" }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import { createInAppNotification, countUnreadNotifications } from "@/lib/inAppNotifications";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inAppNotifications", () => {
  it("creates a notification", async () => {
    const row = await createInAppNotification({
      tenantId: "t1",
      userId: "u1",
      type: "test",
      title: "Hello",
      body: "World",
      href: "/home",
    });
    expect(row).toEqual({ id: "n1" });
    expect(prisma.inAppNotification.create).toHaveBeenCalled();
  });

  it("counts unread notifications", async () => {
    const count = await countUnreadNotifications("u1");
    expect(count).toBe(0);
  });
});
