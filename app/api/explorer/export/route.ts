import { NextRequest, NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import {
  canExportExplorer,
  canViewBehaviourExplorer,
  canViewStudentAnalysis,
  canViewTeacherAnalysis,
} from "@/modules/authz";
import { computeTeacherPivot, computeTeacherRiskIndex } from "@/modules/analysis/teacherRisk";
import { computeCpdPriorities } from "@/modules/analysis/cpdPriorities";
import { computeDepartmentPivot } from "@/modules/analysis/departmentPivot";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { computeCohortPivot } from "@/modules/analysis/cohortPivot";
import { withApi } from "@/lib/apiRoute";

const WINDOW_OPTIONS = [7, 21, 28, 90] as const;
type WindowDays = (typeof WINDOW_OPTIONS)[number];

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsv).join(",");
}

export const POST = withApi(async function POST(req: NextRequest | Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ANALYSIS");

    const body = await req.formData();
    const view = (body.get("view") as string) ?? "INSTRUCTION_TEACHERS_PIVOT";
    const rawWindow = Number(body.get("windowDays") ?? "21");
    const windowDays: WindowDays = WINDOW_OPTIONS.includes(rawWindow as WindowDays)
      ? (rawWindow as WindowDays)
      : 21;
    let departmentId = (body.get("departmentId") as string) ?? "";
    const yearGroup = (body.get("yearGroup") as string) ?? "";
    const teacherMembershipId = (body.get("teacherMembershipId") as string) ?? "";
    const subject = (body.get("subject") as string) ?? "";
    const studentSearch = (body.get("studentSearch") as string) ?? "";

    const [hodMemberships, coachAssignments] = await Promise.all([
      (prisma as any).departmentMembership.findMany({ where: { userId: user.id, isHeadOfDepartment: true } }),
      (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
    ]);
    const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
    const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
    const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

    if (!canExportExplorer(viewerContext)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isBehaviourView = view === "BEHAVIOUR_STUDENTS_TABLE" || view === "BEHAVIOUR_COHORTS_PIVOT";
    if (isBehaviourView && !canViewBehaviourExplorer(viewerContext)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantSettings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
    const schoolType = (tenantSettings?.schoolType ?? "SECONDARY") as "PRIMARY" | "SECONDARY";
    const signalDefs = getSignalDefinitionsForSchoolType(schoolType);
    const signalKeys = signalDefs.map((s) => s.key);
    const signalLabels = new Map(signalDefs.map((s) => [s.key, s.displayNameDefault]));

    const exportedAt = new Date().toISOString();
    const metaLines = [
      `# exportedAt: ${exportedAt}`,
      `# windowDays: ${windowDays}`,
      `# view: ${view}`,
      `# filters: dept=${departmentId || "all"} yearGroup=${yearGroup || "all"} teacher=${teacherMembershipId || "all"}`,
    ];

    const csvLines: string[] = [...metaLines];

    if (view === "INSTRUCTION_TEACHERS_PIVOT") {
      const { rows } = await computeTeacherPivot(user.tenantId, windowDays);
      let filteredRows = rows;

      if (user.role === "HOD" && hodDepartmentIds.length > 0) {
        const deptMembers = await (prisma as any).departmentMembership.findMany({
          where: { tenantId: user.tenantId, departmentId: { in: hodDepartmentIds } },
        });
        const allowed = new Set((deptMembers as any[]).map((m: any) => m.userId));
        filteredRows = filteredRows.filter((r) => allowed.has(r.teacherMembershipId));
      }
      if (departmentId) {
        const deptMembers = await (prisma as any).departmentMembership.findMany({
          where: { tenantId: user.tenantId, departmentId },
        });
        const ids = new Set((deptMembers as any[]).map((m: any) => m.userId));
        filteredRows = filteredRows.filter((r) => ids.has(r.teacherMembershipId));
      }

      const headerSignalParts = signalKeys.flatMap((k) => [
        `${signalLabels.get(k) ?? k} (current)`,
        `${signalLabels.get(k) ?? k} (delta)`,
      ]);
      csvLines.push(buildRow(["Teacher", "Departments", "Coverage", "Band", "Drift", ...headerSignalParts]));

      for (const row of filteredRows) {
        const signalParts = signalKeys.flatMap((k) => [
          row.signalData[k]?.currentMean !== null ? row.signalData[k]?.currentMean?.toFixed(3) ?? "" : "",
          row.signalData[k]?.delta !== null ? row.signalData[k]?.delta?.toFixed(3) ?? "" : "",
        ]);
        csvLines.push(buildRow([
          row.teacherName,
          row.departmentNames.join("; "),
          row.teacherCoverage,
          row.status,
          row.normalizedIDS.toFixed(3),
          ...signalParts,
        ]));
      }
    } else if (view === "PRIORITIES_TEACHERS") {
      const deptMemberships = await (prisma as any).departmentMembership.findMany({
        where: { tenantId: user.tenantId },
      });
      const teacherDepts = new Map<string, string[]>();
      for (const m of deptMemberships as any[]) {
        if (!teacherDepts.has(m.userId)) teacherDepts.set(m.userId, []);
        teacherDepts.get(m.userId)!.push(m.departmentId);
      }

      const allRows = await computeTeacherRiskIndex(user.tenantId, windowDays);
      const rows = allRows.filter((row) =>
        canViewTeacherAnalysis(viewerContext, {
          teacherUserId: row.teacherMembershipId,
          teacherDepartmentIds: teacherDepts.get(row.teacherMembershipId) ?? [],
        })
      );

      const STATUS_LABELS: Record<string, string> = {
        SIGNIFICANT_DRIFT: "Significant drift",
        EMERGING_DRIFT: "Emerging drift",
        STABLE: "Stable",
        LOW_COVERAGE: "Low coverage",
      };

      csvLines.push(
        buildRow([
          "Teacher",
          "Department(s)",
          "Coverage",
          "Drift status",
          "Drift score",
          "Last observed",
        ])
      );
      for (const row of rows) {
        const lastObs =
          row.lastObservationAt !== null
            ? new Date(row.lastObservationAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "";
        csvLines.push(
          buildRow([
            row.teacherName,
            row.departmentNames.join(", "),
            row.teacherCoverage,
            STATUS_LABELS[row.status] ?? row.status,
            row.status === "LOW_COVERAGE" ? "" : row.normalizedIDS.toFixed(1),
            lastObs,
          ])
        );
      }
    } else if (view === "PRIORITIES_CPD") {
      const hodMemberships = await (prisma as any).departmentMembership.findMany({
        where: { userId: user.id, isHeadOfDepartment: true },
        include: { department: true },
      });
      const hodDepartments: { id: string; name: string }[] = (hodMemberships as any[]).map((m: any) => ({
        id: m.departmentId,
        name: m.department.name,
      }));
      const isHod = user.role === "HOD";
      let cpdDepartmentId = departmentId;
      if (isHod && !cpdDepartmentId && hodDepartments.length > 0) {
        cpdDepartmentId = hodDepartments[0].id;
      }
      if (isHod && cpdDepartmentId) {
        const allowed = hodDepartments.map((d) => d.id);
        if (!allowed.includes(cpdDepartmentId)) {
          cpdDepartmentId = hodDepartments[0]?.id;
        }
      }
      const filters = cpdDepartmentId ? { departmentId: cpdDepartmentId } : undefined;
      const rows = await computeCpdPriorities(user.tenantId, windowDays, filters);

      csvLines.push(
        buildRow([
          "Signal",
          "Drift rate (%)",
          "Avg negative delta",
          "Teachers covered",
          "Improving rate (%)",
        ])
      );
      for (const row of rows) {
        csvLines.push(
          buildRow([
            row.label,
            row.teachersCovered === 0 ? "" : Math.round(row.driftRate * 100),
            row.avgNegativeDelta !== null ? row.avgNegativeDelta.toFixed(2) : "",
            row.teachersCovered,
            row.teachersCovered === 0 ? "" : Math.round(row.improvingRate * 100),
          ])
        );
      }
    } else if (view === "PRIORITIES_STUDENTS") {
      if (!canViewStudentAnalysis(viewerContext)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { rows } = await computeStudentRiskIndex(user.tenantId, windowDays, user.id);
      csvLines.push(
        buildRow([
          "Student",
          "Year",
          "Band",
          "Score",
          "Drivers",
          "Attendance%",
          "AttendanceDelta",
          "DetentionsDelta",
          "OnCallsDelta",
          "LatenessDelta",
          "SuspensionsDelta",
          "SEND",
          "PP",
        ])
      );
      for (const row of rows) {
        csvLines.push(
          buildRow([
            row.studentName,
            row.yearGroup ?? "",
            row.band,
            row.riskScore,
            row.drivers.map((d) => d.label).join("; "),
            row.attendancePct !== null ? row.attendancePct.toFixed(2) : "",
            row.attendanceDelta !== null ? row.attendanceDelta.toFixed(2) : "",
            row.detentionsDelta !== null ? row.detentionsDelta : "",
            row.onCallsDelta !== null ? row.onCallsDelta : "",
            row.latenessDelta !== null ? row.latenessDelta : "",
            row.suspensionsDelta !== null ? row.suspensionsDelta : "",
            row.sendFlag ? "Y" : "N",
            row.ppFlag ? "Y" : "N",
          ])
        );
      }
    } else if (view === "INSTRUCTION_DEPARTMENTS_PIVOT") {
      const filterIds = user.role === "HOD" && hodDepartmentIds.length > 0 ? hodDepartmentIds : undefined;
      const { rows } = await computeDepartmentPivot(user.tenantId, windowDays, filterIds);
      let filteredRows = rows;
      if (departmentId) filteredRows = filteredRows.filter((r) => r.departmentId === departmentId);

      const headerSignalParts = signalKeys.flatMap((k) => [
        `${signalLabels.get(k) ?? k} (current)`,
        `${signalLabels.get(k) ?? k} (delta)`,
      ]);
      csvLines.push(buildRow(["Department", "Teachers", "Observations", ...headerSignalParts]));

      for (const row of filteredRows) {
        const signalParts = signalKeys.flatMap((k) => [
          row.signalData[k]?.currentMean !== null ? row.signalData[k]?.currentMean?.toFixed(3) ?? "" : "",
          row.signalData[k]?.delta !== null ? row.signalData[k]?.delta?.toFixed(3) ?? "" : "",
        ]);
        csvLines.push(buildRow([row.departmentName, row.teacherCount, row.observationCount, ...signalParts]));
      }
    } else if (view === "INSTRUCTION_LIST") {
      const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      const obsWhere: any = { tenantId: user.tenantId, observedAt: { gte: windowStart } };

      let scopedTeacherIds: string[] | null = null;
      if (user.role === "HOD" && hodDepartmentIds.length > 0) {
        const hodMembers = await (prisma as any).departmentMembership.findMany({
          where: { tenantId: user.tenantId, departmentId: { in: hodDepartmentIds } },
          select: { userId: true },
        });
        scopedTeacherIds = (hodMembers as any[]).map((m: any) => m.userId);
        obsWhere.observedTeacherId = { in: scopedTeacherIds };
      }

      if (departmentId) {
        const deptMembers = await (prisma as any).departmentMembership.findMany({
          where: { tenantId: user.tenantId, departmentId },
          select: { userId: true },
        });
        const deptUserIds = (deptMembers as any[]).map((m: any) => m.userId);
        if (scopedTeacherIds) {
          const intersection = deptUserIds.filter((id: string) => scopedTeacherIds!.includes(id));
          obsWhere.observedTeacherId = { in: intersection };
        } else {
          obsWhere.observedTeacherId = { in: deptUserIds };
        }
      }

      if (teacherMembershipId) {
        obsWhere.observedTeacherId = teacherMembershipId;
      }

      if (yearGroup) obsWhere.yearGroup = yearGroup;
      if (subject) obsWhere.subject = { contains: subject, mode: "insensitive" };

      const observations = await (prisma as any).observation.findMany({
        where: obsWhere,
        include: { observedTeacher: { select: { fullName: true } }, observer: { select: { fullName: true } } },
        orderBy: { observedAt: "desc" },
        take: 1000,
      });

      csvLines.push(buildRow(["Date", "Teacher", "Year", "Subject", "Phase", "Observer"]));
      for (const obs of observations as any[]) {
        csvLines.push(buildRow([
          new Date(obs.observedAt).toISOString().slice(0, 10),
          obs.observedTeacher?.fullName ?? "",
          obs.yearGroup,
          obs.subject,
          obs.phase,
          obs.observer?.fullName ?? "",
        ]));
      }
    } else if (view === "BEHAVIOUR_STUDENTS_TABLE") {
      const { rows } = await computeStudentRiskIndex(user.tenantId, windowDays, user.id);
      let filteredRows = rows;
      if (yearGroup) filteredRows = filteredRows.filter((r) => r.yearGroup === yearGroup);
      if (studentSearch) {
        const q = studentSearch.toLowerCase();
        filteredRows = filteredRows.filter((r) => r.studentName.toLowerCase().includes(q));
      }

      csvLines.push(buildRow(["Student", "Year", "Band", "Score", "Drivers", "Attendance%", "AttendanceDelta", "DetentionsDelta", "OnCallsDelta", "LatenessDelta", "SuspensionsDelta", "SEND", "PP"]));
      for (const row of filteredRows) {
        csvLines.push(buildRow([
          row.studentName,
          row.yearGroup ?? "",
          row.band,
          row.riskScore,
          row.drivers.map((d) => d.label).join("; "),
          row.attendancePct !== null ? row.attendancePct.toFixed(2) : "",
          row.attendanceDelta !== null ? row.attendanceDelta.toFixed(2) : "",
          row.detentionsDelta !== null ? row.detentionsDelta : "",
          row.onCallsDelta !== null ? row.onCallsDelta : "",
          row.latenessDelta !== null ? row.latenessDelta : "",
          row.suspensionsDelta !== null ? row.suspensionsDelta : "",
          row.sendFlag ? "Y" : "N",
          row.ppFlag ? "Y" : "N",
        ]));
      }
    } else if (view === "BEHAVIOUR_COHORTS_PIVOT") {
      const { rows } = await computeCohortPivot(user.tenantId, windowDays);
      let filteredRows = rows;
      if (yearGroup) filteredRows = filteredRows.filter((r) => r.yearGroup === yearGroup);

      csvLines.push(buildRow(["YearGroup", "StudentsCovered", "AttendanceMean", "AttendanceDelta", "DetentionsMean", "DetentionsDelta", "OnCallsMean", "OnCallsDelta", "LatenessMean", "LatenessDelta", "SuspensionsTotal", "SuspensionsDelta", "ExclusionsTotal", "ExclusionsDelta"]));
      for (const row of filteredRows) {
        csvLines.push(buildRow([
          row.yearGroup,
          row.studentsCovered,
          row.attendanceMean !== null ? row.attendanceMean.toFixed(2) : "",
          row.attendanceDelta !== null ? row.attendanceDelta.toFixed(2) : "",
          row.detentionsMean !== null ? row.detentionsMean.toFixed(2) : "",
          row.detentionsDelta !== null ? row.detentionsDelta.toFixed(2) : "",
          row.onCallsMean !== null ? row.onCallsMean.toFixed(2) : "",
          row.onCallsDelta !== null ? row.onCallsDelta.toFixed(2) : "",
          row.latenessMean !== null ? row.latenessMean.toFixed(2) : "",
          row.latenessDelta !== null ? row.latenessDelta.toFixed(2) : "",
          row.suspensionsCount,
          row.suspensionsDelta !== null ? row.suspensionsDelta : "",
          row.internalExclusionsCount,
          row.internalExclusionsDelta !== null ? row.internalExclusionsDelta : "",
        ]));
      }
    }

    const csv = csvLines.join("\n");
    const filename = `explorer-${view.toLowerCase()}-${windowDays}d-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN" || error?.message === "FEATURE_DISABLED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.error("Explorer export error", { error: error?.message ?? String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
