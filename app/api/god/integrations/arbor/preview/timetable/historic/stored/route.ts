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
  const url = new URL("/god/integrations/arbor", req.url);
  url.searchParams.set("timetableHistoricStored", "success");
  url.searchParams.set("timetableHistoricStoredAll", String(allRows));
  url.searchParams.set("timetableHistoricStoredVerified", String(verifiedRows));
  url.searchParams.set("timetableHistoricStoredSamples", samples.map((row: { className: string | null }) => row.className || "No class label").join("; ").slice(0, 700));
  url.searchParams.set("connectionId", integration.id);
  return NextResponse.redirect(url);
});
