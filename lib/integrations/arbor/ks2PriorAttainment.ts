/** A confirmed KS2 scaled-score result, normalised from Arbor's source. */
export type Ks2Result = {
  studentExternalId: string;
  subject: "reading" | "maths";
  score: number;
};

export type Ks2Student = {
  id: string;
  tenantId: string;
  externalId: string | null;
  ks2ReadingScaledScore: number | null;
  ks2MathsScaledScore: number | null;
};

/** Backfill only: preserve recorded values and skip conflicting source marks. */
export function planKs2Backfill(students: Ks2Student[], results: Ks2Result[]) {
  const scores = new Map<string, Set<number>>();
  let invalid = 0;
  for (const result of results) {
    if (!Number.isInteger(result.score) || result.score < 80 || result.score > 120) { invalid++; continue; }
    const key = `${result.studentExternalId}:${result.subject}`;
    const values = scores.get(key) ?? new Set<number>();
    values.add(result.score);
    scores.set(key, values);
  }
  let conflicts = 0;
  let preserved = 0;
  const updates: Array<{ student: Ks2Student; data: Partial<Pick<Ks2Student, "ks2ReadingScaledScore" | "ks2MathsScaledScore">> }> = [];
  for (const student of students) {
    if (!student.externalId) continue;
    const data: Partial<Pick<Ks2Student, "ks2ReadingScaledScore" | "ks2MathsScaledScore">> = {};
    for (const [subject, field] of [["reading", "ks2ReadingScaledScore"], ["maths", "ks2MathsScaledScore"]] as const) {
      const values = scores.get(`${student.externalId}:${subject}`);
      if (!values) continue;
      if (student[field] !== null) { preserved++; continue; }
      if (values.size !== 1) { conflicts++; continue; }
      data[field] = [...values][0];
    }
    if (Object.keys(data).length) updates.push({ student, data });
  }
  return { updates, invalid, conflicts, preserved };
}
