import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  InstitutionalDashboard,
  type DashboardAttentionDef,
  type DashboardMetricDef,
} from "@/app/(tenant)/admin/InstitutionalDashboard";

export async function OverviewAdminPanel() {
  const user = await requireAdminUser();
  const tid = user.tenantId;

  const [
    loaCount,
    onCallReasonCount,
    locationCount,
    recipientCount,
    timetableCount,
    activeJobCount,
    activeUserCount,
    inactiveUserCount,
    departmentCount,
    hodCount,
    enabledFeatureCount,
    timetableUnknownTeacherCount,
    failedEmailCount,
  ] = await Promise.all([
    prisma.loaReason.count({ where: { tenantId: tid } }),
    (prisma as any).onCallReason.count({ where: { tenantId: tid } }),
    (prisma as any).onCallLocation.count({ where: { tenantId: tid } }),
    (prisma as any).onCallRecipient.count({ where: { tenantId: tid } }),
    (prisma as any).timetableEntry.count({ where: { tenantId: tid } }),
    prisma.importJob.count({ where: { tenantId: tid, status: { in: ["PENDING", "PROCESSING", "RUNNING"] } } }),
    prisma.user.count({ where: { tenantId: tid, isActive: true } }),
    prisma.user.count({ where: { tenantId: tid, isActive: false } }),
    prisma.department.count({ where: { tenantId: tid } }),
    prisma.departmentMembership.count({ where: { tenantId: tid, isHeadOfDepartment: true } }),
    prisma.tenantFeature.count({ where: { tenantId: tid, enabled: true } }),
    (prisma as any).timetableEntry.count({ where: { tenantId: tid, teacherUserId: null } }),
    prisma.emailLog.count({
      where: {
        tenantId: tid,
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const taxonomyCount = loaCount + onCallReasonCount + locationCount + recipientCount;
  const hasTimetable = timetableCount > 0;
  const updatedAtLabel = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const metrics: DashboardMetricDef[] = [
    {
      label: "Active staff",
      value: activeUserCount,
      detail: `${inactiveUserCount} inactive ${inactiveUserCount === 1 ? "profile" : "profiles"} retained`,
      href: "/admin?section=users",
      iconId: "users",
      tone: activeUserCount > 0 ? "success" : "warning",
    },
    {
      label: "Departments",
      value: departmentCount,
      detail: `${hodCount} head${hodCount === 1 ? "" : "s"} of department assigned`,
      href: "/admin?section=departments",
      iconId: "departments",
      tone: departmentCount > 0 ? "success" : "warning",
    },
    {
      label: "Timetable rows",
      value: timetableCount,
      detail:
        timetableUnknownTeacherCount > 0
          ? `${timetableUnknownTeacherCount} rows need teacher matching`
          : "Teacher mapping is complete",
      href: "/admin?section=timetable",
      iconId: "timetable",
      tone: !hasTimetable || timetableUnknownTeacherCount > 0 ? "warning" : "success",
    },
    {
      label: "Enabled modules",
      value: enabledFeatureCount,
      detail: `${taxonomyCount} taxonomy ${taxonomyCount === 1 ? "entry" : "entries"} configured`,
      href: "/admin/features",
      iconId: "features",
      tone: enabledFeatureCount > 0 ? "default" : "warning",
    },
  ];

  const attentionItems: DashboardAttentionDef[] = [
    ...(activeJobCount > 0
      ? [
          {
            title: `${activeJobCount} import ${activeJobCount === 1 ? "job" : "jobs"} running`,
            detail: "Review validation progress",
            href: "/admin?section=imports",
            tone: "critical" as const,
            cta: "Open imports",
          },
        ]
      : []),
    ...(!hasTimetable
      ? [
          {
            title: "Timetable not synced",
            detail: "Upload schedule data to unlock class context",
            href: "/admin?section=timetable",
            tone: "warning" as const,
            cta: "Sync timetable",
          },
        ]
      : []),
    ...(timetableUnknownTeacherCount > 0
      ? [
          {
            title: "Teacher matches needed",
            detail: `${timetableUnknownTeacherCount} timetable rows are unassigned`,
            href: "/admin?section=timetable",
            tone: "warning" as const,
            cta: "Resolve matches",
          },
        ]
      : []),
    ...(taxonomyCount === 0
      ? [
          {
            title: "Taxonomies are empty",
            detail: "Set leave and on-call categories",
            href: "/admin?section=taxonomies",
            tone: "warning" as const,
            cta: "Configure",
          },
        ]
      : []),
    ...(failedEmailCount > 0
      ? [
          {
            title: `${failedEmailCount} email${failedEmailCount === 1 ? "" : "s"} failed this week`,
            detail: "Review delivery errors in the email log",
            href: "/admin?section=email-log",
            tone: "critical" as const,
            cta: "View log",
          },
        ]
      : []),
  ];

  return (
    <InstitutionalDashboard
      sections={[]}
      metrics={metrics}
      attentionItems={attentionItems}
      updatedAtLabel={updatedAtLabel}
    />
  );
}
