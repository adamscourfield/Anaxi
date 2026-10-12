import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { prisma } from "@/lib/prisma";

const ACADEMIC_YEAR = "2025/2026";
const EFFECTIVE_FROM = new Date("2025-09-01T00:00:00.000Z");

/** Shows the saved historic-link evidence before any repair is attempted. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration) return NextResponse.redirect(new URL("/god/integrations/arbor?timetableHistoricStored=not-connected", req.url));
  const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
  const baseWhere = { tenantId: { in: tenantIds }, dataSource: "ARBOR", effectiveFrom: EFFECTIVE_FROM };
  const [allRows, verifiedRows, samples] = await Promise.all([
    db.studentSubjectTeacher.count({ where: baseWhere }),
    db.studentSubjectTeacher.count({ where: { ...baseWhere, className: { contains: ACADEMIC_YEAR } } }),
    db.studentSubjectTeacher.findMany({ where: baseWhere, select: { className: true }, distinct: ["className"], take: 8, orderBy: { className: "asc" } }),
  ]);
  const examPoints = await db.assessmentPoint.findMany({
    where: { tenantId: { in: tenantIds }, cycle: { academicYear: { in: [ACADEMIC_YEAR, "2025/26"] } }, label: { in: ["Final Results", "GCSE Actual Results", "Actual Results"] } },
    select: { id: true, label: true, cycle: { select: { label: true } }, assessments: { select: { results: { select: { student: { select: { id: true, fullName: true, externalId: true } } } } } } },
  });
  const roster = await db.studentSubjectTeacher.findMany({ where: { ...baseWhere, className: { contains: ACADEMIC_YEAR } }, select: { studentId: true, className: true, subject: { select: { name: true } }, student: { select: { fullName: true, externalId: true } } } });
  const norm = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const examReports = examPoints.map((point: any) => {
    const pupils = [...new Map<string, any>(point.assessments.flatMap((assessment: any) => assessment.results.map((result: any) => [result.student.id, result.student]))).values()];
    const missing = pupils.filter((pupil: any) => !roster.some((row: any) => row.studentId === pupil.id));
    const otherId = missing.filter((pupil: any) => pupil.externalId && roster.some((row: any) => row.student.externalId === pupil.externalId)).length;
    const otherName = missing.filter((pupil: any) => roster.some((row: any) => norm(row.student.fullName) === norm(pupil.fullName))).length;
    const classes = [...new Set(roster.filter((row: any) => pupils.some((pupil: any) => pupil.id === row.studentId)).map((row: any) => `${row.subject.name}: ${row.className}`))];
    return `${point.cycle.label} ${point.label}: ${pupils.length} assessed pupils; ${pupils.length - missing.length} with historic roster; ${missing.filter((p: any) => p.externalId).length} missing pupils have external IDs; ${otherId} match another roster pupil by external ID; ${otherName} by exact name. Classes: ${classes.join("; ").slice(0, 650)}`;
  });
  const url = new URL("/god/integrations/arbor", req.url);
  url.searchParams.set("timetableHistoricStored", "success");
  url.searchParams.set("timetableHistoricStoredAll", String(allRows));
  url.searchParams.set("timetableHistoricStoredVerified", String(verifiedRows));
  url.searchParams.set("timetableHistoricStoredSamples", (examReports.length ? examReports.join(" | ") : samples.map((row: { className: string | null }) => row.className || "No class label").join("; ")).slice(0, 5000));
  url.searchParams.set("connectionId", integration.id);
  return NextResponse.redirect(url);
});
