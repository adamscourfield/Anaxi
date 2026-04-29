import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { InstitutionalDashboard, type DashboardSectionDef } from "./InstitutionalDashboard";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminIndexPage() {
  const user = await requireAdminUser();

  const tid = user.tenantId;

  const [loaCount, onCallReasonCount, locationCount, recipientCount, timetableCount, activeJobCount] =
    await Promise.all([
      prisma.loaReason.count({ where: { tenantId: tid } }),
      (prisma as any).onCallReason.count({ where: { tenantId: tid } }),
      (prisma as any).onCallLocation.count({ where: { tenantId: tid } }),
      (prisma as any).onCallRecipient.count({ where: { tenantId: tid } }),
      (prisma as any).timetableEntry.count({ where: { tenantId: tid } }),
      prisma.importJob.count({ where: { tenantId: tid, status: { in: ["PENDING", "PROCESSING", "RUNNING"] } } }),
    ]);

  const taxonomyCount = loaCount + onCallReasonCount + locationCount + recipientCount;

  const hasTimetable = timetableCount > 0;

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
          href: "/admin/terminology",
          label: "Terminology",
          desc: "Customize internal nomenclature and system-wide labels.",
          iconId: "terminology",
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

  return <InstitutionalDashboard sections={sections} />;
}
