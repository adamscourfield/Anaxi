import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { prisma } from "@/lib/prisma";

// This is a proof-of-data check for the last completed academic year, not an import.
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }

  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?timetableHistoric=not-connected", req.url));
  }

  try {
    const asOfDate = "2026-06-30";
    const preview = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).previewHistoricTimetableRoster(asOfDate);
    const stored = await prisma.studentSubjectTeacher.findMany({
      where: { tenantId: { in: integration.schools.map((school: { tenantId: string }) => school.tenantId) }, dataSource: "ARBOR", className: { contains: "Year 9", mode: "insensitive" }, subject: { name: { contains: "math", mode: "insensitive" } } },
      select: { studentId: true, className: true, teacher: { select: { fullName: true } }, subject: { select: { name: true } } },
    });
    const classes = new Map<string, Set<string>>();
    const pupils = new Map<string, Set<string>>();
    for (const row of stored) {
      const key = `${row.subject.name}: ${row.className}`;
      if (!classes.has(key)) classes.set(key, new Set());
      classes.get(key)!.add(row.teacher.fullName);
      if (!pupils.has(row.studentId)) pupils.set(row.studentId, new Set());
      pupils.get(row.studentId)!.add(row.className ?? "");
    }
    const storedReport = `Stored Y9 Maths: ${stored.length} links, ${pupils.size} pupils, ${[...pupils.values()].filter((names) => names.size > 1).length} pupils with competing classes. ${[...classes].map(([name, teachers]) => `${name} => ${[...teachers].join(", ")}`).join("; ")}`;
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableHistoric", "success");
    url.searchParams.set("timetableHistoricDate", asOfDate);
    url.searchParams.set("timetableHistoricAssignments", String(preview.assignments.length));
    url.searchParams.set("timetableHistoricMemberships", String(preview.diagnostics.memberships));
    url.searchParams.set("timetableHistoricActive", String(preview.diagnostics.activeMemberships));
    url.searchParams.set("timetableHistoricClasses", String(preview.diagnostics.classes));
    url.searchParams.set("timetableHistoricSubjects", String(preview.diagnostics.subjectClasses));
    url.searchParams.set("timetableHistoricTeachers", String(preview.diagnostics.staffedClasses));
    url.searchParams.set("timetableHistoricSamples", `${storedReport.slice(0, 1400)} | Live Arbor: ${preview.diagnostics.sampleClasses.join("; ").slice(0, 1600)}`);
    url.searchParams.set("connectionId", integration.id);
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableHistoric", "failed");
    url.searchParams.set("timetableError", error instanceof Error ? error.message.slice(0, 500) : "Historic roster preview failed.");
    return NextResponse.redirect(url);
  }
});
