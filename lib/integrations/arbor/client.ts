import { runArborGraphqlQuery } from "./graphqlClient";
import type {
  ArborCredentials,
  ArborStaffRecord,
  ArborStudentRecord,
  ArborTeachingGroupRecord,
} from "./types";

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
  async listAttendanceRecords(pageSize = 1, pageNum = 0, startAfter?: string, startBefore?: string): Promise<Array<{ id: string; student: { id: string }; attendanceMark: { code: string; isStatisticalPresent: boolean; isStatisticalPossibleAttendance: boolean; isDefaultLate: boolean } | null; minutesLate: number | null; isRedundant: boolean }>> {
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
    const data = await runArborGraphqlQuery<{ AttendanceRecord: Array<{ id: string; student: { id: string }; attendanceMark: { code: string; isStatisticalPresent: boolean; isStatisticalPossibleAttendance: boolean; isDefaultLate: boolean } | null; minutesLate: number | null; isRedundant: boolean }> }>(this.credentials, query);
    return data.AttendanceRecord;
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
}

/** Arbor's REST endpoint may use a generic content type, so validate the actual file. */
function photoMimeType(bytes: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
