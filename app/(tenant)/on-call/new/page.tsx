import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { OnCallRequestForm } from "@/components/oncall/OnCallRequestForm";
import { REASON_CATEGORIES, LOCATION_SUGGESTIONS } from "@/modules/oncall/types";

export default async function OnCallNewPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ON_CALL");

  if (!hasOnCallPermission(user.role, "oncall:create")) {
    redirect("/on-call");
  }

  const students = await (prisma as any).student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, upn: true, yearGroup: true },
  });

  // Tenant-customized reasons/locations from Admin → Taxonomies, falling
  // back to the defaults for tenants that haven't set any up.
  const [reasonRows, locationRows] = await Promise.all([
    (prisma as any).onCallReason.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { label: true },
    }),
    (prisma as any).onCallLocation.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { label: true },
    }),
  ]);
  const reasons = reasonRows.length > 0
    ? reasonRows.map((r: { label: string }) => r.label)
    : [...REASON_CATEGORIES];
  const locations = locationRows.length > 0
    ? locationRows.map((l: { label: string }) => l.label)
    : [...LOCATION_SUGGESTIONS];

  // ── On-Call Density: hourly counts for the last 8 hours ─────────────────
  const now = new Date();
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const recentRequests = await (prisma as any).onCallRequest.findMany({
    where: {
      tenantId: user.tenantId,
      createdAt: { gte: eightHoursAgo },
    },
    select: { createdAt: true },
  });

  // Build hourly buckets [0..7] where 0 = 8 hours ago, 7 = most recent hour
  const hourlyBuckets = Array(8).fill(0) as number[];
  for (const req of recentRequests as { createdAt: Date }[]) {
    const hoursAgo = Math.floor((now.getTime() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60));
    if (hoursAgo >= 0 && hoursAgo < 8) {
      hourlyBuckets[7 - hoursAgo]++;
    }
  }

  // ── Today's volume ───────────────────────────────────────────────────────
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const [todayCount, yesterdayCount] = await Promise.all([
    (prisma as any).onCallRequest.count({
      where: { tenantId: user.tenantId, createdAt: { gte: todayStart } },
    }),
    (prisma as any).onCallRequest.count({
      where: {
        tenantId: user.tenantId,
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
  ]);

  // Day-of-week label for context
  const dayLabel = now.toLocaleDateString("en-GB", { weekday: "long" });

  // Peak activity flag: if current hour bucket is above average
  const avgPerHour = hourlyBuckets.reduce((a, b) => a + b, 0) / 8;
  const currentBucket = hourlyBuckets[7];
  const isPeakActivity = currentBucket > avgPerHour && currentBucket > 0;

  return (
    <OnCallRequestForm
      students={students}
      reasons={reasons}
      locations={locations}
      hourlyBuckets={hourlyBuckets}
      todayCount={todayCount as number}
      yesterdayCount={yesterdayCount as number}
      dayLabel={dayLabel}
      isPeakActivity={isPeakActivity}
    />
  );
}
