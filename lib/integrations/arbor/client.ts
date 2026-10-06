import { runArborGraphqlQuery } from "./graphqlClient";
import type {
  ArborCredentials,
  ArborStaffRecord,
  ArborStudentRecord,
  ArborTeachingGroupRecord,
} from "./types";

export type ArborAssessmentStudent = {
  id: string;
  legalFirstName: string | null;
  legalLastName: string | null;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  displayAcademicLevel: { displayName: string } | null;
  leavingDate: string | null;
};

export type ArborAssessmentMark = {
  id: string;
  student: ArborAssessmentStudent;
  assessmentDate: string | null;
  displayName: string | null;
  valueFields: Record<string, string | number | boolean | null>;
  grade: { displayName: string | null; shortName: string | null; code: string | null } | null;
  assessment: { id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null } | null;
};

export type ArborProgressAssessmentBatchTarget = {
  id: string;
  displayName: string | null;
  progressAssessmentBatch: {
    id: string;
    batchName: string | null;
    currentReferenceDate: string | null;
    assessment: { id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null } | null;
  } | null;
  students: ArborAssessmentStudent[];
  studentProgressAssessmentMarks: ArborAssessmentMark[];
};

/**
 * Client for Arbor's GraphQL API, scoped to the entities Anaxi actually has read
 * access to (see entities.ts). GraphQL is used rather than REST: it supports nested
 * fetches in one request (REST needs a follow-up call per related object's `href`),
 * gives explicit per-field permission errors instead of REST's silent empty object on
 * no access, and its page_size/page_num filters are simpler than REST's dotted
 * `filters.x.y.operator=value` syntax for what a sync needs (date-range and
 * roll-status filters, mostly).
 *
 * `listStaff`/`listStudents`/`listTeachingGroups` build queries from field names
 * Arbor's own GraphQL docs showed for these entities — real, not guessed — but are
 * UNVERIFIED against a live Arbor instance: no sandbox credentials or network access
 * yet. Treat a first real run of each as a test, not a known-working sync step: check
 * the response for field-level permission errors (ArborGraphqlError lists exactly
 * which `Entity.field` is missing) before trusting the data shape.
 *
 * Deliberately NOT implemented: anything needing `profilePicture` (student/staff
 * avatars) — that entity isn't in Anaxi's permission grant yet, so this needs a
 * Developer Portal change, not code, before it can be built. Also not implemented:
 * behaviour (detention/internalExclusion/fixedPeriodExclusion/pointAward), assessment
 * data, SEND/PP/UPN, and a standalone timetable-slot listing — Arbor's docs only
 * showed timetable slots nested under a specific TeachingGroup → academicUnit query,
 * not a top-level filterable query, so a real "all slots in this date range" method
 * needs that confirmed first rather than guessed.
 */
export class ArborClient {
  constructor(private readonly credentials: ArborCredentials) {}

  private restUrl(path: string): string {
    return `https://${this.credentials.schoolHostname}.uk.arbor.sc/rest-v2${path}`;
  }

  private basicAuthorization(): string {
    return `Basic ${Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString("base64")}`;
  }

  /**
   * Verifies the saved application credentials with the smallest confirmed read:
   * one staff ID. This deliberately does not retain or import any Arbor data.
   */
  async verifyConnection(): Promise<void> {
    await runArborGraphqlQuery<{ Staff: Array<{ id: string }> }>(
      this.credentials,
      "{ Staff(page_size: 1, page_num: 0) { id } }"
    );
  }

  /**
   * Checks the staff-absence capability without reading personal absence details
   * or attempting a mutation. Arbor exposes its mutation catalogue separately,
   * so a listed operation is useful evidence for the next design step, not an
   * authorisation to create an absence.
   */
  async inspectStaffAbsenceAccess(): Promise<{ fields: string[]; writeOperations: string[] }> {
    const read = await runArborGraphqlQuery<{
      StaffAbsence: Array<{ id: string }>;
      type: { fields: Array<{ name: string }> } | null;
    }>(this.credentials, `{
      StaffAbsence(page_size: 1, page_num: 0) { id }
      type: __type(name: "StaffAbsence") { fields { name } }
    }`);

    let writeOperations: string[] = [];
    try {
      const schema = await runArborGraphqlQuery<{
        __schema: { mutationType: { fields: Array<{ name: string }> } | null };
      }>(this.credentials, `{
        __schema { mutationType { fields { name } } }
      }`);
      writeOperations = (schema.__schema.mutationType?.fields ?? [])
        .map((field) => field.name)
        .filter((name) => /staff.*absence|absence.*staff/i.test(name));
    } catch {
      // Read access is still useful. A locked-down schema should not obscure it.
    }

    return { fields: read.type?.fields.map((field) => field.name) ?? [], writeOperations };
  }

  /**
   * Confirms the four incident sources that map to Anaxi's existing behaviour
   * measures. This is deliberately a one-record read from each source only.
   */
  async verifyBehaviourAccess(): Promise<{ pointAwards: number; detentions: number; internalExclusions: number; suspensions: number }> {
    const data = await runArborGraphqlQuery<{
      PointAward: Array<{ id: string }>;
      Detention: Array<{ id: string }>;
      InternalExclusion: Array<{ id: string }>;
      FixedPeriodExclusion: Array<{ id: string }>;
    }>(this.credentials, `{
      PointAward(page_size: 1, page_num: 0) { id student { id } points awardedDatetime }
      Detention(page_size: 1, page_num: 0) { id student { id } decisionDatetime }
      InternalExclusion(page_size: 1, page_num: 0) { id student { id } issuedDatetime }
      FixedPeriodExclusion(page_size: 1, page_num: 0) { id student { id } fromDatetime }
    }`);
    return {
      pointAwards: data.PointAward.length,
      detentions: data.Detention.length,
      internalExclusions: data.InternalExclusion.length,
      suspensions: data.FixedPeriodExclusion.length,
    };
  }

  /** Confirms Arbor's progress-assessment marks, rather than empty ad-hoc placeholders. */
  async verifyAssessmentAccess(): Promise<number> {
    const data = await runArborGraphqlQuery<{ StudentProgressAssessmentMark: Array<{ id: string }> }>(this.credentials, `{
      StudentProgressAssessmentMark(page_size: 1, page_num: 0) {
        id
        student { id }
        assessment { id displayName assessmentName assessmentShortName }
        assessmentDate
        grade { displayName }
      }
    }`);
    return data.StudentProgressAssessmentMark.length;
  }

  async listAssessmentMarks(pageSize = 100, pageNum = 0, assessmentIds?: string[], dateRange?: { from: string; before: string }): Promise<ArborAssessmentMark[]> {
    const assessmentFilter = assessmentIds?.length ? `, assessment__id_in: [${assessmentIds.map((id) => JSON.stringify(id)).join(", ")}]` : "";
    const dateFilter = dateRange ? `, assessmentDate_after_or_equal: ${JSON.stringify(dateRange.from)}, assessmentDate_before: ${JSON.stringify(dateRange.before)}` : "";
    const data = await runArborGraphqlQuery<{ StudentProgressAssessmentMark: Omit<ArborAssessmentMark, "valueFields">[] }>(this.credentials, `{
      StudentProgressAssessmentMark(page_size: ${pageSize}, page_num: ${pageNum}${assessmentFilter}${dateFilter}) {
        id student { id legalFirstName legalLastName preferredFirstName preferredLastName leavingDate displayAcademicLevel { displayName } } assessmentDate displayName grade { displayName shortName code } assessment { id displayName assessmentName assessmentShortName }
      }
    }`);
    return data.StudentProgressAssessmentMark.map((mark) => ({
      ...mark,
      valueFields: {},
    }));
  }

  /**
   * Historic summative mark sheets are stored as batch targets in Arbor. Each
   * target is a real subject roster, avoiding the broad cross-subject results
   * returned by the generic StudentProgressAssessmentMark feed.
   */
  async listProgressAssessmentBatchTargets(ids: string[], filter: "batch" | "target" = "batch"): Promise<ArborProgressAssessmentBatchTarget[]> {
    if (!ids.length) return [];
    const targets: ArborProgressAssessmentBatchTarget[] = [];
    for (let offset = 0; offset < ids.length; offset += 20) {
      const pageIds = ids.slice(offset, offset + 20);
      for (let pageNum = 0; pageNum < 100; pageNum++) {
        const data = await runArborGraphqlQuery<{ ProgressAssessmentBatchTarget: (Omit<ArborProgressAssessmentBatchTarget, "studentProgressAssessmentMarks"> & { studentProgressAssessmentMarks: Omit<ArborAssessmentMark, "valueFields">[] })[] }>(this.credentials, `{
          ProgressAssessmentBatchTarget(page_size: 100, page_num: ${pageNum}, ${filter === "batch" ? "progressAssessmentBatch__id_in" : "id_in"}: [${pageIds.map((id) => JSON.stringify(id)).join(", ")}]) {
            id displayName
            progressAssessmentBatch {
              id batchName currentReferenceDate
              assessment { id displayName assessmentName assessmentShortName }
            }
            students { id legalFirstName legalLastName preferredFirstName preferredLastName leavingDate displayAcademicLevel { displayName } }
            studentProgressAssessmentMarks {
              id assessmentDate displayName
              student { id legalFirstName legalLastName preferredFirstName preferredLastName leavingDate displayAcademicLevel { displayName } }
              grade { displayName shortName code }
              assessment { id displayName assessmentName assessmentShortName }
            }
          }
        }`);
        const pageTargets = Array.isArray(data.ProgressAssessmentBatchTarget) ? data.ProgressAssessmentBatchTarget : [];
        targets.push(...pageTargets.map((target) => ({
          ...target,
          // Arbor may omit either relationship for an empty or unfinished
          // mark sheet. Preserve the target and let review show an empty
          // roster instead of failing the whole historic discovery run.
          students: Array.isArray(target.students) ? target.students : [],
          studentProgressAssessmentMarks: Array.isArray(target.studentProgressAssessmentMarks)
            ? target.studentProgressAssessmentMarks.map((mark) => ({ ...mark, valueFields: {} }))
            : [],
        })));
        if (pageTargets.length < 100) break;
      }
    }
    return targets;
  }

  async listProgressAssessmentBatches(pageSize = 100, pageNum = 0): Promise<Array<{ id: string; batchName: string | null; currentReferenceDate: string | null; assessment: { id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null } | null }>> {
    const data = await runArborGraphqlQuery<{ ProgressAssessmentBatch: Array<{ id: string; batchName: string | null; currentReferenceDate: string | null; assessment: { id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null } | null }> }>(this.credentials, `{
      ProgressAssessmentBatch(page_size: ${pageSize}, page_num: ${pageNum}) {
        id batchName currentReferenceDate
        assessment { id displayName assessmentName assessmentShortName }
      }
    }`);
    return Array.isArray(data.ProgressAssessmentBatch) ? data.ProgressAssessmentBatch : [];
  }

  async getProgressAssessmentBatchTarget(id: string): Promise<ArborProgressAssessmentBatchTarget | null> {
    const targets = await this.listProgressAssessmentBatchTargets([id], "target");
    return targets.find((target) => target.id === id) ?? null;
  }

  /** Reads every page of recorded progress marks using Arbor's confirmed page size. */
  async listAllAssessmentMarks(): Promise<Awaited<ReturnType<typeof this.listAssessmentMarks>>> {
    const marks: Awaited<ReturnType<typeof this.listAssessmentMarks>> = [];
    for (let pageNum = 0; pageNum < 1000; pageNum++) {
      const page = await this.listAssessmentMarks(100, pageNum);
      marks.push(...page);
      if (page.length < 100) return marks;
    }
    throw new Error("Arbor returned more than 100,000 progress assessment marks; preview stopped safely.");
  }

  async listAssessmentMarksForDefinitions(assessmentIds: string[]): Promise<Awaited<ReturnType<typeof this.listAssessmentMarks>>> {
    const marks: Awaited<ReturnType<typeof this.listAssessmentMarks>> = [];
    for (let offset = 0; offset < assessmentIds.length; offset += 20) {
      const ids = assessmentIds.slice(offset, offset + 20);
      for (let pageNum = 0; pageNum < 200; pageNum++) {
        const page = await this.listAssessmentMarks(100, pageNum, ids);
        marks.push(...page);
        if (page.length < 100) break;
      }
    }
    return marks;
  }

  /**
   * Reads a complete subject mark sheet for review. A subject normally has one
   * record per pupil, but paging keeps the review correct for larger cohorts.
   */
  async listAssessmentMarksForDefinitionInRange(assessmentId: string, dateRange?: { from: string; before: string }): Promise<Awaited<ReturnType<typeof this.listAssessmentMarks>>> {
    const marks: Awaited<ReturnType<typeof this.listAssessmentMarks>> = [];
    for (let pageNum = 0; pageNum < 20; pageNum++) {
      // Arbor's combined subject-and-date filter can return an incomplete
      // roster for historic assessments. Read the complete subject definition
      // and apply the simple date boundary locally instead.
      const page = await this.listAssessmentMarks(500, pageNum, [assessmentId]);
      marks.push(...(dateRange
        ? page.filter((mark) => Boolean(mark.assessmentDate) && mark.assessmentDate! >= dateRange.from && mark.assessmentDate! < dateRange.before)
        : page));
      if (page.length < 500) return marks;
    }
    throw new Error("Arbor returned more than 10,000 marks for one assessment; review stopped safely.");
  }

  /** Lists the assessment catalogue itself, independently of mark pagination. */
  async listAllAssessmentDefinitions(): Promise<Array<{ id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null }>> {
    const assessments: Array<{ id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null }> = [];
    for (let pageNum = 0; pageNum < 200; pageNum++) {
      const data = await runArborGraphqlQuery<{ Assessment: Array<{ id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null }> }>(this.credentials, `{
        Assessment(page_size: 500, page_num: ${pageNum}) { id displayName assessmentName assessmentShortName }
      }`);
      assessments.push(...data.Assessment);
      if (data.Assessment.length < 500) return assessments;
    }
    throw new Error("Arbor returned more than 100,000 assessment definitions; catalogue preview stopped safely.");
  }

  /** Reads the schema only, so assessment mapping can use confirmed Arbor fields. */
  async inspectAdHocAssessmentFields(): Promise<string[]> {
    const data = await runArborGraphqlQuery<{ __type: { fields: Array<{ name: string }> } | null }>(this.credentials, `{
      __type(name: "Assessment") { fields { name } }
    }`);
    return data.__type?.fields.map((field) => field.name) ?? [];
  }

  /** Reads the Grade schema only, before Anaxi attempts to interpret categorical marks. */
  async inspectAssessmentGradeFields(): Promise<string[]> {
    const data = await runArborGraphqlQuery<{ __type: { fields: Array<{ name: string }> } | null }>(this.credentials, `{
      __type(name: "Grade") { fields { name } }
    }`);
    return data.__type?.fields.map((field) => field.name) ?? [];
  }

  /** Discovers the documented query arguments before filtering assessment marks. */
  async inspectProgressAssessmentMarkFilters(): Promise<string[]> {
    const data = await runArborGraphqlQuery<{ __schema: { queryType: { fields: Array<{ name: string; args: Array<{ name: string }> }> } } }>(this.credentials, `{
      __schema { queryType { fields { name args { name } } } }
    }`);
    return data.__schema.queryType.fields.find((field) => field.name === "StudentProgressAssessmentMark")?.args.map((arg) => arg.name) ?? [];
  }

  /** Lists the permitted mark fields before Anaxi relies on an Arbor period relationship. */
  async inspectProgressAssessmentMarkFields(): Promise<string[]> {
    const data = await runArborGraphqlQuery<{ __type: { fields: Array<{ name: string }> } | null }>(this.credentials, `{
      __type(name: "StudentProgressAssessmentMark") { fields { name } }
    }`);
    return data.__type?.fields.map((field) => field.name) ?? [];
  }

  /**
   * Historic summative outcomes can live in Arbor's progress-batch or
   * qualification-result models rather than the live progress-mark model.
   * Probe each source with an ID-only, read-only query so God Mode can report
   * the exact missing permission instead of guessing which store has grades.
   */
  async inspectHistoricAssessmentSources(): Promise<{ available: string[]; blocked: string[] }> {
    const sources = [
      "StudentProgressAssessmentMark",
      "ProgressAssessmentBatch",
      "ProgressAssessmentBatchTarget",
      "QualificationResult",
      "QualificationAward",
      "QualificationSubject",
    ];
    const available: string[] = [];
    const blocked: string[] = [];
    for (const source of sources) {
      try {
        await runArborGraphqlQuery<Record<string, Array<{ id: string }>>>(this.credentials, `{ ${source}(page_size: 1, page_num: 0) { id } }`);
        available.push(source);
      } catch {
        blocked.push(source);
      }
    }
    return { available, blocked };
  }

  /**
   * Returns the permitted relationship fields needed to map historic results.
   *
   * Arbor's entity names alone are not sufficient to form a safe nested query:
   * the relationship can resolve to an object, a connection, or a scalar. Keep
   * the GraphQL type beside each field so the integration is built from the
   * tenant's schema rather than trial-and-error requests against pupil data.
   */
  async inspectHistoricAssessmentSourceFields(): Promise<Record<string, string[]>> {
    const sources = ["ProgressAssessmentBatch", "ProgressAssessmentBatchTarget", "QualificationResult", "QualificationAward", "QualificationSubject"];
    const result: Record<string, string[]> = {};
    for (const source of sources) {
      const data = await runArborGraphqlQuery<{
        __type: { fields: Array<{ name: string; type: { kind: string; name: string | null; ofType: { kind: string; name: string | null; ofType: { kind: string; name: string | null } | null } | null } }> } | null;
        __schema: { queryType: { fields: Array<{ name: string; args: Array<{ name: string }> }> } };
      }>(this.credentials, `{
        __type(name: ${JSON.stringify(source)}) {
          fields {
            name
            type { kind name ofType { kind name ofType { kind name } } }
          }
        }
        __schema { queryType { fields { name args { name } } } }
      }`);
      const formatType = (type: { kind: string; name: string | null; ofType: { kind: string; name: string | null; ofType: { kind: string; name: string | null } | null } | null }): string => {
        if (type.name) return type.name;
        if (type.ofType?.name) return `${type.kind}<${type.ofType.name}>`;
        if (type.ofType?.ofType?.name) return `${type.kind}<${type.ofType.kind}<${type.ofType.ofType.name}>>`;
        return type.kind;
      };
      const query = data.__schema.queryType.fields.find((field) => field.name === source);
      result[source] = [
        ...(data.__type?.fields.map((field) => `${field.name}: ${formatType(field.type)}`) ?? []),
        `query arguments: ${(query?.args.map((arg) => arg.name).join(", ") || "none")}`,
      ];
    }
    return result;
  }

  /** One read-only page of the four behaviour sources Anaxi currently measures. */
  async listBehaviourRecords(pageSize = 100, pageNum = 0, startAfter?: string, startBefore?: string): Promise<ArborBehaviourRecords> {
    const pointFilters = startAfter && startBefore ? `, awardedDatetime_after: "${startAfter}", awardedDatetime_before: "${startBefore}"` : "";
    const detentionFilters = startAfter && startBefore ? `, decisionDatetime_after: "${startAfter}", decisionDatetime_before: "${startBefore}"` : "";
    const internalExclusionFilters = startAfter && startBefore ? `, issuedDatetime_after: "${startAfter}", issuedDatetime_before: "${startBefore}"` : "";
    const suspensionFilters = startAfter && startBefore ? `, fromDatetime_after: "${startAfter}", fromDatetime_before: "${startBefore}"` : "";
    return runArborGraphqlQuery<ArborBehaviourRecords>(this.credentials, `{
      PointAward(page_size: ${pageSize}, page_num: ${pageNum}${pointFilters}) { id student { id } points awardedDatetime }
      Detention(page_size: ${pageSize}, page_num: ${pageNum}${detentionFilters}) { id student { id } decisionDatetime }
      InternalExclusion(page_size: ${pageSize}, page_num: ${pageNum}${internalExclusionFilters}) { id student { id } issuedDatetime }
      FixedPeriodExclusion(page_size: ${pageSize}, page_num: ${pageNum}${suspensionFilters}) { id student { id } fromDatetime }
    }`);
  }

  async listAllBehaviourRecords(startAfter: string, startBefore: string): Promise<ArborBehaviourRecords> {
    const all: ArborBehaviourRecords = { PointAward: [], Detention: [], InternalExclusion: [], FixedPeriodExclusion: [] };
    for (let pageNum = 0; pageNum < 200; pageNum++) {
      const page = await this.listBehaviourRecords(500, pageNum, startAfter, startBefore);
      all.PointAward.push(...page.PointAward);
      all.Detention.push(...page.Detention);
      all.InternalExclusion.push(...page.InternalExclusion);
      all.FixedPeriodExclusion.push(...page.FixedPeriodExclusion);
      if (page.PointAward.length < 500 && page.Detention.length < 500 && page.InternalExclusion.length < 500 && page.FixedPeriodExclusion.length < 500) return all;
    }
    throw new Error("Behaviour preview exceeded 100,000 records for one source and stopped safely.");
  }

  /**
   * Arbor documents this separately from GraphQL's entity permissions. The response
   * body is deliberately not read or retained: this is only an authorisation check.
   */
  async verifyStudentPhotoAccess(studentId: string): Promise<void> {
    const response = await fetch(this.restUrl(`/profile-picture/student/${encodeURIComponent(studentId)}`), { headers: { Authorization: this.basicAuthorization() } });
    if (!response.ok) throw new Error(`Arbor photo endpoint returned HTTP ${response.status}.`);
  }

  async getStudentPhoto(studentId: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
    return this.getPhoto(`/profile-picture/student/${encodeURIComponent(studentId)}`);
  }

  async getStaffPhoto(staffId: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
    return this.getPhoto(`/profile-picture/staff/${encodeURIComponent(staffId)}`);
  }

  /** A one-page, read-only attendance check. It intentionally does not retain marks. */
  async listAttendanceRecords(pageSize = 1, pageNum = 0, startAfter?: string, startBefore?: string): Promise<Array<{ id: string; student: { id: string }; attendanceMark: { code: string; isStatisticalPresent: boolean; isStatisticalPossibleAttendance: boolean; isDefaultLate: boolean } | null; startDatetime: string | null; minutesLate: number | null; isRedundant: boolean }>> {
    const dateFilters = startAfter && startBefore ? `, startDatetime_after: "${startAfter}", startDatetime_before: "${startBefore}"` : "";
    const query = `{
      AttendanceRecord(page_size: ${pageSize}, page_num: ${pageNum}${dateFilters}) {
        id
        student { id }
        attendanceMark { code isStatisticalPresent isStatisticalPossibleAttendance isDefaultLate }
        startDatetime
        endDatetime
        minutesLate
        isRedundant
        modifiedDatetime
      }
    }`;
    const data = await runArborGraphqlQuery<{ AttendanceRecord: Array<{ id: string; student: { id: string }; attendanceMark: { code: string; isStatisticalPresent: boolean; isStatisticalPossibleAttendance: boolean; isDefaultLate: boolean } | null; startDatetime: string | null; minutesLate: number | null; isRedundant: boolean }> }>(this.credentials, query);
    return data.AttendanceRecord;
  }

  async listAllAttendanceRecords(startAfter: string, startBefore: string) {
    const records = [] as Awaited<ReturnType<typeof this.listAttendanceRecords>>;
    for (let pageNum = 0; pageNum < 200; pageNum++) {
      const page = await this.listAttendanceRecords(500, pageNum, startAfter, startBefore);
      records.push(...page);
      if (page.length < 500) return records;
    }
    throw new Error("Attendance preview exceeded 100,000 records and stopped safely.");
  }

  private async getPhoto(path: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
    const response = await fetch(this.restUrl(path), { headers: { Authorization: this.basicAuthorization() } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Arbor photo endpoint returned HTTP ${response.status}.`);
    const declaredSize = Number(response.headers.get("content-length") ?? "0");
    if (declaredSize > 2 * 1024 * 1024) throw new Error("Arbor returned a photo larger than 2MB.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) return null;
    if (bytes.length > 2 * 1024 * 1024) throw new Error("Arbor returned a photo larger than 2MB.");
    const mimeType = photoMimeType(bytes);
    if (!mimeType) throw new Error("Arbor returned a photo in an unsupported format.");
    return { bytes, mimeType };
  }

  async listStaff(pageSize = 500, pageNum = 0): Promise<ArborStaffRecord[]> {
    const query = `{
      Staff(page_size: ${pageSize}, page_num: ${pageNum}) {
        id
        legalFirstName
        legalLastName
        preferredFirstName
        preferredLastName
        joiningDate
        leavingDate
        staffNumber
        isActiveInSchool
        isActiveTeachingInSchool
        displayJobTitle
        emailAddresses {
          displayName
          emailAddressType
        }
      }
    }`;
    const data = await runArborGraphqlQuery<{ Staff: ArborStaffRecord[] }>(this.credentials, query);
    return data.Staff;
  }

  /** Retrieves every staff page so a preview never silently shows only the first 500. */
  async listAllStaff(): Promise<ArborStaffRecord[]> {
    const pageSize = 500;
    const staff: ArborStaffRecord[] = [];
    for (let pageNum = 0; pageNum < 200; pageNum++) {
      const page = await this.listStaff(pageSize, pageNum);
      staff.push(...page);
      if (page.length < pageSize) return staff;
    }
    throw new Error("Arbor returned more than 100,000 staff records; preview stopped safely.");
  }

  async listStudents(pageSize = 500, pageNum = 0): Promise<ArborStudentRecord[]> {
    const query = `{
      Student(page_size: ${pageSize}, page_num: ${pageNum}) {
        id
        legalFirstName
        legalLastName
        preferredFirstName
        preferredLastName
        dateOfBirth
        mostRecentEntryDate
        leavingDate
        displayAcademicLevel {
          displayName
        }
        senStatusAssignments {
          startDate
          endDate
          senStatus {
            code
            displayName
          }
        }
      }
    }`;
    const data = await runArborGraphqlQuery<{ Student: ArborStudentRecord[] }>(this.credentials, query);
    return data.Student;
  }

  /** Retrieves every student page so a preview never silently shows only the first 500. */
  async listAllStudents(): Promise<ArborStudentRecord[]> {
    const pageSize = 500;
    const students: ArborStudentRecord[] = [];

    for (let pageNum = 0; pageNum < 200; pageNum++) {
      const page = await this.listStudents(pageSize, pageNum);
      students.push(...page);
      if (page.length < pageSize) return students;
    }

    throw new Error("Arbor returned more than 100,000 students; preview stopped safely.");
  }

  async listTeachingGroups(pageSize = 200, pageNum = 0): Promise<ArborTeachingGroupRecord[]> {
    const query = `{
      TeachingGroup(page_size: ${pageSize}, page_num: ${pageNum}) {
        id
        teachingGroupName
        academicYear {
          code
          displayName
        }
      }
    }`;
    const data = await runArborGraphqlQuery<{ TeachingGroup: ArborTeachingGroupRecord[] }>(
      this.credentials,
      query
    );
    return data.TeachingGroup;
  }

  /**
   * Reads schema names only before timetable data is mapped. Arbor exposes the
   * membership and teacher relations separately, so this prevents us guessing a
   * relationship and assigning a teacher to the wrong student or subject.
   */
  async inspectTimetableMappingFields(): Promise<Record<string, string[]>> {
    type IntrospectionType = { name: string; fields: Array<{ name: string }> } | null;
    const data = await runArborGraphqlQuery<{ membership: IntrospectionType; group: IntrospectionType; tutor: IntrospectionType; unit: IntrospectionType }>(this.credentials, `{
      membership: __type(name: "TeachingGroupMembership") { name fields { name } }
      group: __type(name: "TeachingGroup") { name fields { name } }
      tutor: __type(name: "TeachingGroupTutor") { name fields { name } }
      unit: __type(name: "AcademicUnit") { name fields { name } }
    }`);
    return Object.fromEntries([
      ["membership", data.membership?.fields.map((field) => field.name) ?? []],
      ["group", data.group?.fields.map((field) => field.name) ?? []],
      ["tutor", data.tutor?.fields.map((field) => field.name) ?? []],
      ["academic unit", data.unit?.fields.map((field) => field.name) ?? []],
    ]);
  }

  /**
   * Maps the subject-teacher relationship Arbor exposes through teaching groups.
   * A group roster supplies the students; its tutors supply staff; the linked
   * academic unit supplies the subject.
   */
  async listTimetableTeacherAssignmentsBatch(membershipPage = 0): Promise<{
    assignments: Array<{ studentId: string; teachingGroupId: string; subject: string; staffIds: string[] }>;
    hasMore: boolean;
    diagnostics: { memberships: number; groupsWithSubjects: number; groupsWithTeachers: number };
  }> {
    const fields = await this.inspectTimetableMappingFields();
    // Arbor nests a group's subject through its automatic enrolments, rather than
    // directly on TeachingGroup. This is the relationship in Arbor's domain model.
    const required: Array<[string, string]> = [["membership", "student"], ["membership", "teachingGroup"], ["group", "academicUnitAutomaticEnrolments"], ["tutor", "teachingGroup"], ["tutor", "staff"], ["academic unit", "subject"]];
    const unavailable = required.filter(([entity, field]) => !fields[entity]?.includes(field));
    if (unavailable.length) throw new Error(`Arbor timetable fields unavailable: ${unavailable.map(([entity, field]) => `${entity}.${field}`).join(", ")}.`);

    type TimetableData = {
      TeachingGroupMembership: Array<{ student: { id: string }; teachingGroup: { id: string; academicUnitAutomaticEnrolments: Array<{ academicUnitEnrolments: Array<{ academicUnit: { subject: { displayName: string } | null } | null }> }> } | null }>;
      TeachingGroupTutor: Array<{ teachingGroup: { id: string } | null; staff: { id: string } | null }>;
    };
    const readMembershipPage = async (page: number) => runArborGraphqlQuery<Pick<TimetableData, "TeachingGroupMembership">>(this.credentials, `{
      TeachingGroupMembership(page_size: 100, page_num: ${page}) {
        student { id }
        teachingGroup {
          id
          academicUnitAutomaticEnrolments {
            academicUnitEnrolments { academicUnit { subject { displayName } } }
          }
        }
      }
    }`);
    const readTutorPage = async (page: number) => runArborGraphqlQuery<Pick<TimetableData, "TeachingGroupTutor">>(this.credentials, `{
      TeachingGroupTutor(page_size: 500, page_num: ${page}) {
        teachingGroup { id }
        staff { id }
      }
    }`);

    const membershipData = await readMembershipPage(membershipPage);
    const tutorData = await readTutorPage(0);
    const tutors: TimetableData["TeachingGroupTutor"] = [...tutorData.TeachingGroupTutor];
    for (let tutorPage = 1; tutorPage < 20 && tutorData.TeachingGroupTutor.length === 500; tutorPage++) {
      const data = await readTutorPage(tutorPage);
      tutors.push(...data.TeachingGroupTutor);
      if (data.TeachingGroupTutor.length < 500) break;
      if (tutorPage === 19) throw new Error("Arbor returned more than 10,000 teaching-group tutors; timetable sync stopped safely.");
    }
    const staffByGroup = new Map<string, string[]>();
    for (const tutor of tutors) {
      if (!tutor.teachingGroup || !tutor.staff) continue;
      const staff = staffByGroup.get(tutor.teachingGroup.id) ?? [];
      staff.push(tutor.staff.id);
      staffByGroup.set(tutor.teachingGroup.id, staff);
    }
    const groupsWithSubjects = new Set<string>();
    const groupsWithTeachers = new Set<string>();
    const assignments = membershipData.TeachingGroupMembership.flatMap((membership) => {
        const group = membership.teachingGroup;
        const subjects = group?.academicUnitAutomaticEnrolments
          .flatMap((automaticEnrolment) => automaticEnrolment.academicUnitEnrolments)
          .flatMap((enrolment) => enrolment.academicUnit?.subject?.displayName ? [enrolment.academicUnit.subject.displayName] : []) ?? [];
        const staffIds = group ? staffByGroup.get(group.id) ?? [] : [];
        if (group && subjects.length) groupsWithSubjects.add(group.id);
        if (group && staffIds.length) groupsWithTeachers.add(group.id);
        return group && staffIds.length ? [...new Set(subjects)].map((subject) => ({ studentId: membership.student.id, teachingGroupId: group.id, subject, staffIds })) : [];
    });
    return {
      assignments,
      hasMore: membershipData.TeachingGroupMembership.length === 100,
      diagnostics: {
        memberships: membershipData.TeachingGroupMembership.length,
        groupsWithSubjects: groupsWithSubjects.size,
        groupsWithTeachers: groupsWithTeachers.size,
      },
    };
  }

  /** Reads a small timetable sample before any subject-teacher links are written. */
  async listTimetableTeacherAssignmentsPreview(): Promise<Array<{ studentId: string; teachingGroupId: string; subject: string; staffIds: string[] }>> {
    return (await this.listTimetableTeacherAssignmentsBatch()).assignments;
  }
}

/** Chooses the meaningful result value from the confirmed fields returned by Arbor. */
export function arborAssessmentMarkValue(mark: {
  displayName: string | null;
  grade: { displayName: string | null; shortName: string | null; code: string | null } | null;
  valueFields?: Record<string, string | number | boolean | null>;
}): string | null {
  const directGrade = [mark.grade?.displayName, mark.grade?.shortName, mark.grade?.code]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
  if (directGrade) return directGrade;

  const fields = mark.valueFields ?? {};
  const preferred = ["mark", "value", "result", "score", "numericValue", "percentageValue", "textValue", "gradeValue", "markValue", "resultValue", "resultText", "valueText", "valueNumeric", "assessmentGrade"];
  for (const field of preferred) {
    const value = fields[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  // Arbor deployments expose slightly different scalar result names. Use an
  // explicit value-oriented field only; never fall back to dates or IDs.
  for (const [field, value] of Object.entries(fields)) {
    if (!/(?:mark|grade|score|result|value|percent)/i.test(field)) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return mark.displayName?.trim() || null;
}

export type ArborBehaviourRecords = {
  PointAward: Array<{ id: string; student: { id: string }; points: number; awardedDatetime: string | null }>;
  Detention: Array<{ id: string; student: { id: string }; decisionDatetime: string | null }>;
  InternalExclusion: Array<{ id: string; student: { id: string }; issuedDatetime: string | null }>;
  FixedPeriodExclusion: Array<{ id: string; student: { id: string }; fromDatetime: string | null }>;
};

/** Arbor's REST endpoint may use a generic content type, so validate the actual file. */
function photoMimeType(bytes: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
