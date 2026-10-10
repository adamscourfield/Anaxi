export type AttendanceSample = { pct: number; possible: number; present: number };
/** Weight by registration sessions when every sample has them; otherwise use a labelled pupil mean. */
export function attendanceSummary(samples: AttendanceSample[]) {
  const valid = samples.filter(s => Number.isFinite(s.pct) && s.pct >= 0 && s.pct <= 100);
  if (!valid.length) return { value: null, weighted: false, count: 0 };
  const weighted = valid.every(s => s.possible > 0 && s.present >= 0 && s.present <= s.possible);
  const value = weighted
    ? valid.reduce((n, s) => n + s.present, 0) / valid.reduce((n, s) => n + s.possible, 0) * 100
    : valid.reduce((n, s) => n + s.pct, 0) / valid.length;
  return { value, weighted, count: valid.length };
}
export function classKey(subjectId: string, className: string, yearGroup = "") {
  return JSON.stringify([subjectId, className.trim(), yearGroup]);
}
export function attendanceBand(pct: number) {
  return pct >= 95 ? "95–100%" : pct >= 90 ? "90–94.9%" : "Below 90%";
}

export type RosterLink = { className: string | null; subject: { id: string; name: string }; teacher: { id: string; fullName: string }; student: { id: string; yearGroup: string | null } };
export function groupClassRosters(links: RosterLink[]) {
  const groups = new Map<string, { key: string; name: string; subject: string; years: Set<string>; teachers: Map<string, string>; pupilIds: Set<string> }>();
  for (const link of links) {
    const name = link.className?.trim();
    if (!name) continue;
    const key = classKey(link.subject.id, name);
    const group = groups.get(key) ?? { key, name, subject: link.subject.name, years: new Set<string>(), teachers: new Map<string, string>(), pupilIds: new Set<string>() };
    group.years.add(link.student.yearGroup ?? "Unassigned");
    group.teachers.set(link.teacher.id, link.teacher.fullName);
    group.pupilIds.add(link.student.id);
    groups.set(key, group);
  }
  return [...groups.values()];
}
