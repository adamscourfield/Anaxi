import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  InstitutionalDashboard,
  type DashboardAttentionDef,
  type DashboardMetricDef,
  type DashboardSectionDef,
} from "./InstitutionalDashboard";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminIndexPage() {
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
    vocabCount,
    signalLabelCount,
    timetableUnknownTeacherCount,
  ] =
    await Promise.all([
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
      prisma.tenantVocab.count({ where: { tenantId: tid } }),
      prisma.tenantSignalLabel.count({ where: { tenantId: tid } }),
      (prisma as any).timetableEntry.count({ where: { tenantId: tid, teacherUserId: null } }),
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
      href: "/admin/users",
      iconId: "users",
      tone: activeUserCount > 0 ? "success" : "warning",
    },
    {
      label: "Departments",
      value: departmentCount,
      detail: `${hodCount} head${hodCount === 1 ? "" : "s"} of department assigned`,
      href: "/admin/departments",
      iconId: "departments",
      tone: departmentCount > 0 ? "success" : "warning",
    },
    {
      label: "Timetable rows",
      value: timetableCount,
      detail: timetableUnknownTeacherCount > 0 ? `${timetableUnknownTeacherCount} rows need teacher matching` : "Teacher mapping is complete",
      href: "/admin/timetable",
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
      ? [{
          title: `${activeJobCount} import ${activeJobCount === 1 ? "job" : "jobs"} running`,
          detail: "Review validation progress",
          href: "/admin/imports",
          tone: "critical" as const,
          cta: "Open imports",
        }]
      : []),
    ...(!hasTimetable
      ? [{
          title: "Timetable not synced",
          detail: "Upload schedule data to unlock class context",
          href: "/admin/timetable",
          tone: "warning" as const,
          cta: "Sync timetable",
        }]
      : []),
    ...(timetableUnknownTeacherCount > 0
      ? [{
          title: "Teacher matches needed",
          detail: `${timetableUnknownTeacherCount} timetable rows are unassigned`,
          href: "/admin/timetable",
          tone: "warning" as const,
          cta: "Resolve matches",
        }]
      : []),
    ...(taxonomyCount === 0
      ? [{
          title: "Taxonomies are empty",
          detail: "Set leave and on-call categories",
          href: "/admin/taxonomies",
          tone: "warning" as const,
          cta: "Configure",
        }]
      : []),
  ];

  const sections: DashboardSectionDef[] = [
    {
      title: "People & Access",
      tag: "Foundation",
      rows: [
        {
          href: "/admin/users",
          label: "Users",
          desc: "Manage staff profiles, role-based access, and identity authentication.",
          iconId: "users",
        },
        {
          href: "/admin/departments",
          label: "Departments",
          desc: "Organize institutional structures and faculty hierarchies.",
          iconId: "departments",
        },
        {
          href: "/admin/coaching",
          label: "Coaching",
          desc: "Track professional development and mentorship programs.",
          iconId: "coaching",
        },
        {
          href: "/admin/leave-approvals",
          label: "Leave Approvals",
          desc: "Review absence requests and maintain staffing continuity.",
          iconId: "leaveApprovals",
        },
      ],
    },
    {
      title: "Platform & Language",
      tag: "Standardization",
      rows: [
        {
          href: "/admin/settings",
          label: "Settings",
          desc: "Configure global system behaviors and security protocols.",
          iconId: "settings",
        },
        {
          href: "/admin/features",
          label: "Feature Flags",
          desc: "Enable or disable modules for the tenant workspace.",
          iconId: "features",
        },
        {
          href: "/admin/terminology",
          label: "Terminology",
          desc: "Customize internal nomenclature and system-wide labels.",
          iconId: "terminology",
        },
        {
          href: "/admin/language",
          label: "Language",
          desc: `${vocabCount} vocabulary override${vocabCount === 1 ? "" : "s"} currently configured.`,
          iconId: "language",
        },
        {
          href: "/admin/signals",
          label: "Signals",
          desc: `${signalLabelCount} observation signal label${signalLabelCount === 1 ? "" : "s"} customized.`,
          iconId: "signals",
        },
      ],
    },
    {
      title: "Data & Imports",
      tag: "Processing",
      rows: [
        {
          href: "/admin/taxonomies",
          label: "Taxonomies",
          desc: "Manage complex categorical hierarchies and tagging systems.",
          iconId: "taxonomies",
          badge: taxonomyCount > 0 ? { type: "taxonomy", count: taxonomyCount } : undefined,
        },
        {
          href: "/admin/timetable",
          label: "Timetable",
          desc: "Review and override institutional scheduling matrices.",
          iconId: "timetable",
          badge: hasTimetable ? { type: "timetable", synced: true } : undefined,
        },
        {
          href: "/admin/imports",
          label: "Import Jobs",
          desc: "Bulk data ingestion, validation logs, and sync history.",
          iconId: "imports",
          badge: activeJobCount > 0 ? { type: "imports", activeCount: activeJobCount } : undefined,
        },
      ],
    },
  ];

  return (
    <InstitutionalDashboard
      sections={sections}
      metrics={metrics}
      attentionItems={attentionItems}
      updatedAtLabel={updatedAtLabel}
    />
  );
}
