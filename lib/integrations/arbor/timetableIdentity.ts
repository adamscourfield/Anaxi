type PersonRecord = {
  id: string;
  tenantId: string;
  fullName: string;
  externalId: string | null;
};

export type TimetableIdentityMatch = { person: PersonRecord; method: "EXTERNAL_ID" | "UNIQUE_NAME" };

function normaliseName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function addUnique(map: Map<string, PersonRecord | null>, key: string, person: PersonRecord) {
  const existing = map.get(key);
  map.set(key, existing === undefined ? person : existing?.id === person.id ? person : null);
}

function addCandidate(map: Map<string, PersonRecord[]>, key: string, person: PersonRecord) {
  const candidates = map.get(key) ?? [];
  if (!candidates.some((candidate) => candidate.id === person.id)) candidates.push(person);
  map.set(key, candidates);
}

/**
 * Resolves timetable people without guessing. Arbor IDs are authoritative; an
 * exact full-name fallback is allowed only when it identifies one Anaxi record.
 */
export function buildTimetableIdentityResolver(rows: PersonRecord[]) {
  const byExternalId = new Map<string, PersonRecord | null>();
  const staffByTenantAndExternalId = new Map<string, PersonRecord | null>();
  const studentsByName = new Map<string, PersonRecord | null>();
  const studentsByExternalIdCandidates = new Map<string, PersonRecord[]>();
  const studentsByNameCandidates = new Map<string, PersonRecord[]>();
  const staffByTenantAndName = new Map<string, PersonRecord | null>();

  for (const person of rows) {
    if (person.externalId) {
      addUnique(byExternalId, person.externalId, person);
      addCandidate(studentsByExternalIdCandidates, person.externalId, person);
    }
    // Arbor staff can legitimately be linked to separate Anaxi accounts in
    // Primary and Secondary. Resolve teacher IDs within the pupil's school.
    if (person.externalId) addUnique(staffByTenantAndExternalId, `${person.tenantId}\u0000${person.externalId}`, person);
    const name = normaliseName(person.fullName);
    if (!name) continue;
    addUnique(studentsByName, name, person);
    addCandidate(studentsByNameCandidates, name, person);
    addUnique(staffByTenantAndName, `${person.tenantId}\u0000${name}`, person);
  }

  return {
    student(externalId: string, fullName: string): TimetableIdentityMatch | null {
      const byId = byExternalId.get(externalId);
      if (byId) return { person: byId, method: "EXTERNAL_ID" };
      const byName = studentsByName.get(normaliseName(fullName));
      return byName ? { person: byName, method: "UNIQUE_NAME" } : null;
    },
    studentCandidates(externalId: string, fullName: string): TimetableIdentityMatch[] {
      const byId = studentsByExternalIdCandidates.get(externalId);
      if (byId?.length) return byId.map((person) => ({ person, method: "EXTERNAL_ID" as const }));
      return (studentsByNameCandidates.get(normaliseName(fullName)) ?? []).map((person) => ({ person, method: "UNIQUE_NAME" as const }));
    },
    staff(tenantId: string, externalId: string, fullName: string): TimetableIdentityMatch | null {
      const byId = staffByTenantAndExternalId.get(`${tenantId}\u0000${externalId}`);
      if (byId) return { person: byId, method: "EXTERNAL_ID" };
      const byName = staffByTenantAndName.get(`${tenantId}\u0000${normaliseName(fullName)}`);
      return byName ? { person: byName, method: "UNIQUE_NAME" } : null;
    },
  };
}
