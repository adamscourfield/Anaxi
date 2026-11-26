/**
 * Believable demo attainment.
 *
 * Each student has a general level ("ability", in standard deviations). KS2 scores are drawn from
 * it, and every subject result is that level plus a lasting strength or weakness in the subject plus
 * noise on the day. That gives what real schools see: subjects correlate at about 0.7, the same
 * subject correlates about 0.9 between two mocks, and KS2 predicts results. A few students
 * genuinely decline or improve between points, and a few classes have a teacher effect, so the
 * analysis pages have something real to find.
 *
 * Everything is keyed on the student's UPN (not on call order), so re-seeding gives the same
 * numbers and other seed changes don't reshuffle them.
 */

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Uniform in [0, 1), fixed for a given key. */
export function keyedUniform(key: string): number {
  let s = (hashString(key) + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  s = (t ^ (t >>> 14)) >>> 0;
  return s / 4294967296;
}

/** Standard normal, fixed for a given key. */
export function keyedGauss(key: string): number {
  const u1 = Math.max(1e-9, keyedUniform(`${key}#a`));
  const u2 = keyedUniform(`${key}#b`);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** General level in SDs. Disadvantaged and SEND students start lower on average, as in national data. */
export function studentAbility(upn: string, flags: { pp: boolean; send: boolean }): number {
  return keyedGauss(`ability:${upn}`) - (flags.pp ? 0.35 : 0) - (flags.send ? 0.5 : 0);
}

/** KS2 scaled score (80–120) that tracks the student's level, about as well as KS2 predicts GCSEs. */
export function ks2Score(upn: string, ability: number, paper: "maths" | "reading"): number {
  const z = 0.7 * ability + 0.72 * keyedGauss(`ks2:${paper}:${upn}`);
  return clamp(Math.round(104 + 6.5 * z), 80, 120);
}

/** About 8% of students slip between result points and 6% pick up, in most of their subjects. */
export function trajectory(upn: string): "declining" | "improving" | "steady" {
  const u = keyedUniform(`trajectory:${upn}`);
  if (u < 0.08) return "declining";
  if (u < 0.14) return "improving";
  return "steady";
}

/**
 * A student's standing in one subject at one result point, in SDs.
 * pointIndex is 0 for the first point and 1 for the second. teacherEffect is in SDs.
 */
export function subjectStanding(
  upn: string,
  ability: number,
  subject: string,
  pointIndex: number,
  teacherEffect = 0,
): number {
  const lasting = keyedGauss(`subject:${upn}:${subject}`);
  const onTheDay = keyedGauss(`day:${upn}:${subject}:${pointIndex}`);
  let change = pointIndex * 0.1; // a little general progress between points
  if (pointIndex > 0 && keyedUniform(`moves:${upn}:${subject}`) < 0.7) {
    const t = trajectory(upn);
    if (t === "declining") change -= 0.6;
    if (t === "improving") change += 0.5;
  }
  return 0.8 * ability + 0.45 * lasting + 0.3 * onTheDay + change + teacherEffect;
}

/** Whether a student takes an optional subject. Same answer at every point. */
export function takesSubject(upn: string, subject: string, share: number): boolean {
  return keyedUniform(`enrol:${upn}:${subject}`) < share;
}

export function isAbsent(upn: string, subject: string, pointIndex: number, rate: number): boolean {
  return keyedUniform(`absent:${upn}:${subject}:${pointIndex}`) < rate;
}

/** Some subjects are marked harder than others; standings are shifted by this many SDs. */
const DIFFICULTY: Record<string, number> = {
  Physics: -0.25, Chemistry: -0.2, "Further Maths": -0.15, French: -0.2, Statistics: 0.15,
  RE: 0.15, Art: 0.2, Music: 0.1, Sociology: 0.1, "English Literature": -0.05,
};

export function gcseGrade(standing: number, subject: string): number {
  return clamp(Math.round(5 + 1.75 * (standing + (DIFFICULTY[subject] ?? 0))), 1, 9);
}

const A_LEVEL = ["U", "E", "D", "C", "B", "A", "A*"] as const;
export function aLevelGrade(standing: number, subject: string): (typeof A_LEVEL)[number] {
  return A_LEVEL[clamp(Math.round(3.6 + 1.3 * (standing + (DIFFICULTY[subject] ?? 0))), 0, 6)];
}

export function percentageScore(standing: number, subject: string): number {
  return clamp(Math.round(62 + 14 * (standing + (DIFFICULTY[subject] ?? 0))), 3, 99);
}

/** Student index within the year, from a demo UPN like "D7012" (year 7, student 12) or "D11045". */
export function indexFromUpn(upn: string, year: number): number {
  return Number.parseInt(upn.slice(1 + String(year).length), 10) - 1;
}

/**
 * Classes with a teacher effect, keyed "Year|Subject|class index" (classes are 45 students in
 * UPN order, matching the class assignments later in the seed). Two below and three above.
 */
export const TEACHER_EFFECTS: Record<string, number> = {
  "Y7|English|1": -0.55,
  "Y11|History|3": -0.55,
  "Y7|Maths|2": 0.4,
  "Y7|Science|0": 0.35,
  "Y11|Maths|0": 0.35,
};

export function teacherEffect(year: string, subject: string, studentIndex: number, classSize = 45): number {
  return TEACHER_EFFECTS[`${year}|${subject}|${Math.floor(studentIndex / classSize)}`] ?? 0;
}
