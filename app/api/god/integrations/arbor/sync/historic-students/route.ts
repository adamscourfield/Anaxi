import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { historicStudentDestination, historicYearGroup } from "@/lib/integrations/arbor/historicStudentArchiving";
import { arborStudentFullName } from "@/lib/integrations/arbor/studentSyncPlan";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

function normalizedYearGroup(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^(?:Year|Y)\s*0?(\d{1,2})$/i);
  const year = match ? Number(match[1]) : NaN;
  return year >= 1 && year <= 13 ? `Y${year}` : null;
}

function hasLeftSchool(leavingDate: string | null | undefined): boolean {
  if (!leavingDate) return false;
  const leaving = new Date(leavingDate);
  if (Number.isNaN(leaving.getTime())) return false;
  return leaving.getTime() < Date.now();
}

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  if (form.get("confirm") !== "ARCHIVE_HISTORIC_STUDENTS") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?historicStudents=confirmation-required", req.url));
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({
    where: arborConnectionWhere(req),
    include: { schools: { where: { enabled: true }, include: { tenant: { include: { tenantSettings: true } } } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?historicStudents=not-connected", req.url));
  }

  const tenantIdBySchoolType: { PRIMARY?: string; SECONDARY?: string } = {};
  for (const school of integration.schools) {
    const schoolType = school.tenant.tenantSettings?.schoolType;
    if (schoolType === "PRIMARY") tenantIdBySchoolType.PRIMARY = school.tenantId;
    if (schoolType === "SECONDARY") tenantIdBySchoolType.SECONDARY = school.tenantId;
  }

  let created = 0;
  let archived = 0;
  let skipped = 0;
  try {
    const [arborStudents, existingStudents] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllStudents(),
      db.student.findMany({
        where: { tenantId: { in: Object.values(tenantIdBySchoolType) }, externalId: { not: null } },
        select: { id: true, tenantId: true, externalId: true, status: true, yearGroup: true },
      }),
    ]);
    const existingByExternalId = new Map<string, Array<{ id: string; tenantId: string; externalId: string; status: string; yearGroup: string | null }>>();
    for (const student of existingStudents as Array<{ id: string; tenantId: string; externalId: string; status: string; yearGroup: string | null }>) {
      existingByExternalId.set(student.externalId, [...(existingByExternalId.get(student.externalId) ?? []), student]);
    }

    for (const arborStudent of arborStudents) {
      // Arbor can retain a leaver's final academic level. A past leaving date
      // is therefore authoritative; otherwise Year 11-13 leavers never reach
      // the historic archive and their assessment results are mis-cohorted.
      const hasLeft = hasLeftSchool(arborStudent.leavingDate);
      if (arborStudent.displayAcademicLevel?.displayName && !hasLeft) continue;
      const existing = existingByExternalId.get(arborStudent.id) ?? [];
      const yearGroup = normalizedYearGroup(arborStudent.displayAcademicLevel?.displayName) ?? historicYearGroup(arborStudent);
      if (existing.length) {
        for (const student of existing) {
          const needsArchive = student.status !== "ARCHIVED";
          const needsFinalYearGroup = Boolean(yearGroup && student.yearGroup !== yearGroup);
          if (!needsArchive && !needsFinalYearGroup) continue;
          await db.student.update({
            where: { id: student.id },
            data: { status: "ARCHIVED", ...(yearGroup ? { yearGroup } : {}) },
          });
          archived++;
        }
        continue;
      }

      const destination = historicStudentDestination(yearGroup);
      const tenantId = destination ? tenantIdBySchoolType[destination] : undefined;
      const fullName = arborStudentFullName(arborStudent);
      if (!tenantId || !yearGroup || !fullName) {
        skipped++;
        continue;
      }
      await db.student.create({
        data: { tenantId, fullName, yearGroup, status: "ARCHIVED", externalId: arborStudent.id, dataSource: "ARBOR" },
      });
      created++;
    }

    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        actorUserId: actor.id,
        action: "integration.arbor.historic_students_archived",
        targetType: "SharedIntegration",
        targetId: integration.id,
        afterJson: { created, archived, skipped },
      },
    });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("historicStudents", "success");
    url.searchParams.set("historicStudentCreated", String(created));
    url.searchParams.set("historicStudentArchived", String(archived));
    url.searchParams.set("historicStudentSkipped", String(skipped));
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("historicStudents", "failed");
    url.searchParams.set("historicStudentError", error instanceof Error ? error.message.slice(0, 180) : "Historic pupil archive sync failed.");
    return NextResponse.redirect(url);
  }
});
