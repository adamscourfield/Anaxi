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
