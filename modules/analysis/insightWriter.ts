/**
 * Insight Writer
 *
 * Reads from all analysis modules, identifies significant findings, and
 * upserts rows into the Insight table. Designed to run on a schedule
 * (e.g. daily) or on-demand from an API route.
 *
 * Existing insights from the same run window are replaced to avoid
 * accumulating stale entries.
 */

import { prisma } from "@/lib/prisma";
import { computeTeacherRiskIndex } from "@/modules/analysis/teacherRisk";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { computeCpdPriorities } from "@/modules/analysis/cpdPriorities";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";
import { computeLOAImpact } from "@/modules/analysis/loaImpact";
import { computeAttainmentBehaviourCorrelation } from "@/modules/analysis/attainmentBehaviourCorrelation";

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 21;
const DRIFT_SEVERITY_THRESHOLD = 2.0;
const VALUE_ADD_CONCERN_THRESHOLD = -0.05;
const PROGRESS_DROP_THRESHOLD = -0.08;
const LOA_DEVIATION_THRESHOLD = 0.1;
const CORRELATION_STRONG_THRESHOLD = 0.4;

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightWriteResult = {
  written: number;
  deleted: number;
  computedAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampSeverity(v: number): number {
  return Math.min(5, Math.max(1, Math.round(v)));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function writeInsights(
  tenantId: string,
  windowDays = WINDOW_DAYS,
): Promise<InsightWriteResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Delete insights generated in this same window to avoid duplication
  const deleteResult = await (prisma as any).insight.deleteMany({
    where: {
      tenantId,
      createdAt: { gte: windowStart },
    },
  });

  // Run all analyses in parallel
  const [teacherRisk, studentRisk, cpdRows, assessment, loaImpact, correlation] =
    await Promise.all([
      computeTeacherRiskIndex(tenantId, windowDays),
      computeStudentRiskIndex(tenantId, windowDays, "system"),
      computeCpdPriorities(tenantId, windowDays),
      computeAssessmentAnalysis(tenantId),
      computeLOAImpact(tenantId, windowDays),
      computeAttainmentBehaviourCorrelation(tenantId, windowDays),
    ]);

  const insightsToCreate: any[] = [];

  // ── 1. Teacher instruction drift ────────────────────────────────────────────

  for (const teacher of teacherRisk) {
    if (
      teacher.status !== "SIGNIFICANT_DRIFT" &&
      teacher.status !== "EMERGING_DRIFT"
    )
      continue;

    const severity = clampSeverity(
      teacher.normalizedIDS >= DRIFT_SEVERITY_THRESHOLD ? 4 : 2,
    );
    const topDriver = teacher.topDrivers[0];
    const summary = topDriver
      ? `IDS ${teacher.normalizedIDS.toFixed(2)}. Top driver: ${topDriver.signalKey} (Δ${topDriver.delta.toFixed(2)})`
      : `IDS ${teacher.normalizedIDS.toFixed(2)}`;

    insightsToCreate.push({
      tenantId,
      type: "DRIFT_DOWN",
      scope: "TEACHER",
      teacherId: teacher.teacherMembershipId,
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: teacher.normalizedIDS,
      deltaValue: teacher.normalizedIDS,
      observationCount: teacher.teacherCoverage,
      severity,
      title: `Instruction drift — ${teacher.teacherName}`,
      summary,
      linkPath: `/explorer/teachers`,
    });
  }

  // ── 2. CPD signal priorities ────────────────────────────────────────────────

  for (const row of cpdRows.slice(0, 5)) {
    if (row.priorityScore <= 0 || row.teachersCovered < 3) continue;

    const severity = clampSeverity(row.driftRate >= 0.4 ? 4 : 2);
    insightsToCreate.push({
      tenantId,
      type: "HOTSPOT",
      scope: "WHOLE_SCHOOL",
      signalKey: row.signalKey as any,
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: row.driftRate,
      deltaValue: -(row.avgNegDeltaAbs ?? 0),
      observationCount: row.teachersCovered,
      severity,
      title: `CPD priority — ${row.label}`,
      summary: `${Math.round(row.driftRate * 100)}% of covered teachers drifting (${row.teachersDriftingDown}/${row.teachersCovered})`,
      linkPath: `/explorer/signals`,
    });
  }

  // ── 3. Student behaviour risk ────────────────────────────────────────────────

  for (const student of studentRisk.rows) {
    if (student.band !== "URGENT" && student.band !== "PRIORITY") continue;

    const severity = clampSeverity(student.band === "URGENT" ? 5 : 3);
    const driverLabels = student.drivers.map((d) => d.label).join(", ");
    insightsToCreate.push({
      tenantId,
      type: "BEHAVIOUR_SPIKE",
      scope: student.yearGroup ? "YEAR" : "WHOLE_SCHOOL",
      yearGroup: student.yearGroup,
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: student.riskScore,
      deltaValue: 0,
      observationCount: 1,
      severity,
      title: `${student.band === "URGENT" ? "Urgent" : "Priority"} student — ${student.studentName}`,
      summary: driverLabels || student.band,
      linkPath: `/explorer/students`,
    });
  }

  // ── 4. Assessment — teacher value-add concern ───────────────────────────────

  for (const teacher of assessment.teachers) {
    if (
      teacher.overallValueAdd === null ||
      teacher.overallValueAdd >= VALUE_ADD_CONCERN_THRESHOLD
    )
      continue;

    const severity = clampSeverity(teacher.overallValueAdd <= -0.15 ? 4 : 2);
    insightsToCreate.push({
      tenantId,
      type: "ATTAINMENT_CONCERN",
      scope: "TEACHER",
      teacherId: teacher.teacherId,
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: teacher.overallMean ?? 0,
      deltaValue: teacher.overallValueAdd,
      observationCount: teacher.subjects.reduce(
        (s, sub) => s + sub.studentCount,
        0,
      ),
      severity,
      title: `Attainment concern — ${teacher.teacherName}`,
      summary: `Value-add ${teacher.overallValueAdd.toFixed(3)}. ${teacher.subjects.length} subject(s).`,
      linkPath: `/explorer/assessment/teachers`,
    });
  }

  // ── 5. Assessment — student progress drops ──────────────────────────────────

  for (const student of assessment.students) {
    const decliningSubjects = student.subjects.filter(
      (s) =>
        s.movement !== null && s.movement < PROGRESS_DROP_THRESHOLD,
    );
    if (decliningSubjects.length === 0) continue;

    const worstMovement = Math.min(...decliningSubjects.map((s) => s.movement!));
    const severity = clampSeverity(worstMovement <= -0.15 ? 4 : 2);
    insightsToCreate.push({
      tenantId,
      type: "PROGRESS_DROP",
      scope: student.yearGroup ? "YEAR" : "WHOLE_SCHOOL",
      yearGroup: student.yearGroup,
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: student.overallMean ?? 0,
      deltaValue: worstMovement,
      observationCount: student.subjects.length,
      severity,
      title: `Progress drop — ${student.studentName}`,
      summary: `Declining in: ${decliningSubjects.map((s) => s.subject).join(", ")}`,
      linkPath: `/explorer/assessment/students`,
    });
  }

  // ── 6. Triangulated risk — behaviour + assessment decline ───────────────────

  const behaviourRiskIds = new Set(
    studentRisk.rows
      .filter((s) => s.band === "URGENT" || s.band === "PRIORITY")
      .map((s) => s.studentId),
  );
  const assessmentDecliningIds = new Set(
    assessment.students
      .filter((s) =>
        s.subjects.some(
          (sub) => sub.movement !== null && sub.movement < PROGRESS_DROP_THRESHOLD,
        ),
      )
      .map((s) => s.studentId),
  );

  const triangulatedIds = new Set(
    [...behaviourRiskIds].filter((id) => assessmentDecliningIds.has(id)),
  );

  for (const studentId of triangulatedIds) {
    const bRow = studentRisk.rows.find((r) => r.studentId === studentId)!;
    const aRow = assessment.students.find((s) => s.studentId === studentId)!;
    const flags = [bRow.sendFlag && "SEND", bRow.ppFlag && "PP"]
      .filter(Boolean)
      .join(", ");

    insightsToCreate.push({
      tenantId,
      type: "TRIANGULATED_RISK",
      scope: bRow.yearGroup ? "YEAR" : "WHOLE_SCHOOL",
      yearGroup: bRow.yearGroup,
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: bRow.riskScore,
      deltaValue: Math.min(...aRow.subjects.map((s) => s.movement ?? 0)),
      observationCount: aRow.subjects.length,
      severity: 5,
      title: `Triangulated risk — ${bRow.studentName}`,
      summary: `${bRow.band} behaviour band + declining assessment${flags ? ` [${flags}]` : ""}`,
      linkPath: `/explorer/assessment/students`,
    });
  }

  // ── 7. LOA impact ────────────────────────────────────────────────────────────

  for (const row of loaImpact.teacherRows) {
    if (
      row.deviation === null ||
      row.deviation < LOA_DEVIATION_THRESHOLD ||
      row.confidence !== "HIGH"
    )
      continue;

    insightsToCreate.push({
      tenantId,
      type: "COMBINED_METRIC_ALERT",
      scope: "TEACHER",
      teacherId: row.teacherId,
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: row.urgentPriorityPct,
      deltaValue: row.deviation,
      observationCount: row.affectedStudentCount,
      severity: clampSeverity(row.deviation >= 0.2 ? 4 : 2),
      title: `LOA impact — ${row.teacherName}`,
      summary: `${row.totalDaysAbsent} days absent. ${Math.round(row.urgentPriorityPct * 100)}% of their students in priority/urgent (school avg ${Math.round(row.schoolUrgentPriorityPct * 100)}%)`,
      linkPath: `/explorer/teachers`,
    });
  }

  // ── 8. Strong attainment–behaviour correlations ─────────────────────────────

  for (const row of correlation.schoolWide) {
    if (
      Math.abs(row.correlation) < CORRELATION_STRONG_THRESHOLD ||
      row.confidence !== "HIGH"
    )
      continue;

    insightsToCreate.push({
      tenantId,
      type: "ATTAINMENT_RISK_TRIANGULATION",
      scope: "WHOLE_SCHOOL",
      windowDays,
      startDate: windowStart,
      endDate: now,
      metricValue: row.correlation,
      deltaValue: row.correlation,
      observationCount: row.sampleSize,
      severity: clampSeverity(Math.abs(row.correlation) >= 0.6 ? 4 : 2),
      title: `Attainment correlation — ${row.metricLabel}`,
      summary: `r=${row.correlation.toFixed(2)} (${row.strength.toLowerCase().replace(/_/g, " ")}) across ${row.sampleSize} students`,
      linkPath: `/explorer/assessment`,
    });
  }

  // ── Write all insights ───────────────────────────────────────────────────────

  if (insightsToCreate.length > 0) {
    await (prisma as any).insight.createMany({ data: insightsToCreate });
  }

  return {
    written: insightsToCreate.length,
    deleted: deleteResult.count,
    computedAt: now,
  };
}
