import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { buildTimetableIdentityResolver } from "@/lib/integrations/arbor/timetableIdentity";
import { prisma } from "@/lib/prisma";

/** Counts only linkable records before subject-teacher relationships can be written. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?timetablePreview=not-connected", req.url));
  try {
    const preview = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listTimetableTeacherAssignmentsPreview();
    const assignments = preview.assignments;
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const [students, staff] = await Promise.all([
      db.student.findMany({ where: { tenantId: { in: tenantIds }, status: "ACTIVE" }, select: { id: true, tenantId: true, fullName: true, externalId: true } }),
      db.user.findMany({ where: { tenantId: { in: tenantIds }, isActive: true }, select: { id: true, tenantId: true, fullName: true, externalId: true } }),
    ]);
    const studentResolver = buildTimetableIdentityResolver(students);
    const staffResolver = buildTimetableIdentityResolver(staff);
    let linkable = 0;
    let studentsMatched = 0;
    let staffMatched = 0;
    for (const assignment of assignments) {
      const studentMatches = studentResolver.studentCandidates(assignment.studentId, assignment.studentName);
      const eligibleStudents = studentMatches.filter((studentMatch) => assignment.staff.some((arborStaff) => staffResolver.staff(studentMatch.person.tenantId, arborStaff.id, arborStaff.fullName)));
      if (eligibleStudents.length !== 1) continue;
      const student = eligibleStudents[0].person;
      studentsMatched++;
      const matchedStaff = assignment.staff.filter((arborStaff) => staffResolver.staff(student.tenantId, arborStaff.id, arborStaff.fullName));
      staffMatched += matchedStaff.length;
      if (matchedStaff.length) linkable++;
    }
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetablePreview", "success");
    url.searchParams.set("timetableAssignments", String(assignments.length));
    url.searchParams.set("timetableLinkable", String(linkable));
    url.searchParams.set("timetableStudentsMatched", String(studentsMatched));
    url.searchParams.set("timetableStaffMatched", String(staffMatched));
    url.searchParams.set("timetablePreviewPages", String(preview.diagnostics.pages));
    url.searchParams.set("timetablePreviewMemberships", String(preview.diagnostics.memberships));
    url.searchParams.set("timetablePreviewCurrent", String(preview.diagnostics.currentMemberships));
    url.searchParams.set("timetablePreviewGroupsRequested", String(preview.diagnostics.groupsRequested));
    url.searchParams.set("timetablePreviewGroupsReturned", String(preview.diagnostics.groupsReturned));
    url.searchParams.set("timetablePreviewSubjects", String(preview.diagnostics.groupsWithSubjects));
    url.searchParams.set("timetablePreviewTeachers", String(preview.diagnostics.groupsWithTeachers));
    url.searchParams.set("connectionId", integration.id);
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetablePreview", "failed");
    url.searchParams.set("timetableError", error instanceof Error ? error.message.slice(0, 300) : "Timetable preview failed.");
    return NextResponse.redirect(url);
  }
});
