import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { attendanceSummary, groupClassRosters } from "./metrics";

export async function loadClasses(tenantId: string, windowDays: number) {
  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 86400000);
  const links = await prisma.studentSubjectTeacher.findMany({
    where: { tenantId, className: { not: null }, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], student: { status: "ACTIVE" } },
    select: { className: true, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } }, student: { select: {
      id: true, fullName: true, yearGroup: true,
      snapshots: { where: { tenantId, snapshotDate: { lte: now } }, orderBy: { snapshotDate: "desc" }, take: 1,
        select: { snapshotDate: true, attendancePct: true, attendancePossibleCount: true, attendancePresentCount: true, positivePointsTotal: true, negativePointsTotal: true, detentionsCount: true, onCallsCount: true, latenessCount: true, suspensionsCount: true, internalExclusionsCount: true, countScope: true } },
    } } },
  });
  const pupils = new Map(links.filter(link => link.className?.trim()).map(link => [link.student.id, {
    id: link.student.id, name: link.student.fullName, yearGroup: link.student.yearGroup ?? "Unassigned",
    snapshot: link.student.snapshots[0] ? { ...link.student.snapshots[0], snapshotDate: link.student.snapshots[0].snapshotDate.toISOString(), attendancePct: Number(link.student.snapshots[0].attendancePct) } : null,
  }]));
  const ids = [...pupils.keys()];
  const [incidents, results] = ids.length ? await Promise.all([
    prisma.behaviourIncident.groupBy({ by: ["studentId", "category"], where: { tenantId, studentId: { in: ids }, occurredAt: { gte: since, lte: now } }, _count: { _all: true }, _sum: { points: true } }),
    prisma.assessmentResult.findMany({ where: { tenantId, studentId: { in: ids }, assessment: { tenantId, point: { assessedAt: { lte: now }, cycle: { tenantId } } } },
      select: { studentId: true, rawValue: true, isValid: true, status: true, normalizedScore: true, assessment: { select: {
        id: true, subject: true, title: true, gradeFormat: true, maxScore: true, createdAt: true,
        point: { select: { id: true, label: true, ordinal: true, assessedAt: true, resultStatus: true, cycle: { select: { id: true, label: true, academicYear: true } } } },
      } } }, orderBy: { assessment: { createdAt: "desc" } } }),
  ]) : [[], []];
  const pupilEvents = new Map<string, Record<string, number>>();
  for (const event of incidents) {
    const counts = pupilEvents.get(event.studentId) ?? {};
    counts[event.category] = event._count._all;
    if (event.category === "POSITIVE_POINTS") counts.positivePoints = event._sum.points ?? 0;
    pupilEvents.set(event.studentId, counts);
  }
  const groups = groupClassRosters(links).map(group => ({ ...group,
    id: createHash("sha256").update(group.key).digest("hex").slice(0, 20),
    yearGroup: [...group.years].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(" / "),
  }));
  const byStudent = new Map<string, typeof results>();
  for (const result of results) {
    const list = byStudent.get(result.studentId) ?? [];
    list.push(result); byStudent.set(result.studentId, list);
  }
  const classes = groups.map(group => {
    const students = [...group.pupilIds].map(id => ({ ...pupils.get(id)!, events: pupilEvents.get(id) ?? {} })).sort((a, b) => a.name.localeCompare(b.name));
    const marks = students.flatMap(student => (byStudent.get(student.id) ?? []).filter(result => result.assessment.subject.trim().toLowerCase() === group.subject.trim().toLowerCase()));
    const pointMap = new Map<string, { id: string; label: string; cycleId: string; cycle: string; date: string; ordinal: number; format: string; maxScore: number | null; status: string }>();
    for (const mark of marks) {
      const assessment = mark.assessment, point = assessment.point;
      const id = assessment.id;
      pointMap.set(id, { id, label: `${point.label} · ${assessment.title}`, cycleId: point.cycle.id, cycle: point.cycle.label, date: point.assessedAt.toISOString(), ordinal: point.ordinal, format: assessment.gradeFormat, maxScore: assessment.maxScore, status: point.resultStatus });
    }
    const points = [...pointMap.values()].sort((a, b) => b.date.localeCompare(a.date) || b.ordinal - a.ordinal || a.id.localeCompare(b.id));
    // Results are ordered newest assessment first. Never silently overwrite a newer mark.
    const gradeMap = new Map<string, typeof marks[number]>();
    for (const mark of marks) {
      const key = JSON.stringify([mark.studentId, mark.assessment.id]);
      if (!gradeMap.has(key)) gradeMap.set(key, mark);
    }
    const rows = students.map(student => ({ ...student, grades: points.map(point => {
      const mark = gradeMap.get(JSON.stringify([student.id, point.id]));
      return { pointId: point.id, value: mark?.rawValue ?? null, valid: mark?.isValid ?? false, status: mark?.status ?? "NOT_ENTERED", normalizedScore: mark?.normalizedScore ?? null };
    }) }));
    const latest = points[0];
    const recorded = latest ? rows.filter(row => row.grades[0]?.valid && row.grades[0]?.status === "PRESENT" && row.grades[0]?.value?.trim()).length : 0;
    const attendance = attendanceSummary(students.flatMap(s => s.snapshot ? [{ pct: s.snapshot.attendancePct, possible: s.snapshot.attendancePossibleCount, present: s.snapshot.attendancePresentCount }] : []));
    const events = students.reduce<Record<string, number>>((total, student) => { for (const [key, count] of Object.entries(student.events)) total[key] = (total[key] ?? 0) + count; return total; }, {});
    return { id: group.id, name: group.name, subject: group.subject, yearGroup: group.yearGroup, teachers: [...group.teachers].map(([id, name]) => ({ id, name })), count: students.length, attendance, events, recorded, latest: latest ? `${latest.cycle} · ${latest.label}` : null, points, students: rows };
  }).sort((a, b) => a.yearGroup.localeCompare(b.yearGroup, undefined, { numeric: true }) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { classes, pupilCount: pupils.size, unlabelled: links.filter(link => !link.className?.trim()).length, since: since.toISOString(), asOf: now.toISOString() };
}
export type ClassData = Awaited<ReturnType<typeof loadClasses>>["classes"][number];
export type ClassSummary = Omit<ClassData, "students" | "points">;
