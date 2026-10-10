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

/** Known MIS curriculum labels and assessment upload names for the same subject. */
export function classSubjectKey(subject: string) {
  const key = subject.trim().toLowerCase().replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    mathematics: "maths", maths: "maths", math: "maths",
    "art and design / art": "art", "art and design": "art", art: "art",
    "design and technology - graphics": "graphics", graphics: "graphics",
    "physical education / sports": "pe", "physical education": "pe", pe: "pe",
    "biology / botany / zoology / ecology": "biology", biology: "biology",
    "government and politics": "politics", politics: "politics",
    "religious education": "re", "religious studies": "re", re: "re", rs: "re",
  };
  return aliases[key] ?? key;
}

export const behaviourScopeLabels: Record<string, string> = { TERM_TO_DATE: "Term to date", YEAR_TO_DATE: "Year to date", ROLLING_21_DAYS: "Rolling 21 days", ROLLING_28_DAYS: "Rolling 28 days" };
export type BehaviourSnapshot = { countScope: string; detentionsCount: number; onCallsCount: number; latenessCount: number; internalExclusionsCount: number; suspensionsCount: number };
export function behaviourSnapshotGroups(snapshots: BehaviourSnapshot[]) {
  const groups = new Map<string, { scope: string; label: string; pupils: number; detentions: number; onCalls: number; lateness: number; internalExclusions: number; suspensions: number }>();
  for (const snapshot of snapshots) {
    const group = groups.get(snapshot.countScope) ?? { scope: snapshot.countScope, label: behaviourScopeLabels[snapshot.countScope] ?? snapshot.countScope, pupils: 0, detentions: 0, onCalls: 0, lateness: 0, internalExclusions: 0, suspensions: 0 };
    group.pupils++; group.detentions += snapshot.detentionsCount; group.onCalls += snapshot.onCallsCount; group.lateness += snapshot.latenessCount; group.internalExclusions += snapshot.internalExclusionsCount; group.suspensions += snapshot.suspensionsCount;
    groups.set(snapshot.countScope, group);
  }
  return [...groups.values()].sort((a, b) => b.pupils - a.pupils || a.scope.localeCompare(b.scope));
}
