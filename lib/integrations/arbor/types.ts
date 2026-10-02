/**
 * Types for the Arbor MIS integration.
 *
 * Entity NAMES are confirmed — see entities.ts, sourced from Anaxi's actual Arbor
 * permission grant, not a guess. Auth and transport are confirmed too — see
 * graphqlClient.ts, built from Arbor's documented GraphQL contract. What's still
 * unconfirmed is the field list for most of the 54 granted entities: Arbor's generic
 * docs show real field names for a handful (Student, Staff, TeachingGroup — see the
 * comments below), but those examples also reference sub-entities Anaxi does NOT have
 * permission for (e.g. `profilePicture`, `guardian`, `medicalCondition`, `demographic`
 * — none of these are in entities.ts). Do not assume a field from those examples is
 * readable without checking it isn't routed through an ungranted entity.
 */

export type { ArborReadableEntity } from "./entities";

/**
 * Credentials a school's Arbor connection is stored with (encrypted — see
 * lib/integrationSecrets.ts). CONFIRMED shape: Arbor's docs state REST and GraphQL
 * both authenticate with "basic auth, using your app's credentials" — i.e. HTTP Basic
 * with a username/password pair, not an API key or OAuth token. Field names
 * (`username`/`password`) are our own naming for that pair, not Arbor's own labels
 * for them — the Developer Portal's app page is what actually names them.
 */
export interface ArborCredentials {
  /** The school's Arbor subdomain, e.g. "sunnyville" for sunnyville.uk.arbor.sc, or "api-sandbox" for testing. */
  schoolHostname: string;
  username: string;
  password: string;
}

/**
 * A staff record, combining Arbor's `staff` and `person` entities (confirmed: Staff
 * queries nest `person { ... }` in the docs' example). Fields below are copied from
 * Arbor's own GraphQL docs example query on `Staff` — real field names, not guesses —
 * but NOT yet verified that Anaxi's specific permission grant exposes every one of
 * them (GraphQL reports field-level permission errors per-query, which a real client
 * would need to handle). `profilePicture` (shown in the docs example, holds a staff
 * photo as base64) is explicitly EXCLUDED here: it is not among Anaxi's 54 granted
 * entities, so staff avatar sync needs that permission added in the Developer Portal
 * before it can be built — this is an action item, not a coding task.
 */
export interface ArborStaffRecord {
  id: string;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  joiningDate: string | null;
  leavingDate: string | null;
  staffNumber: string | null;
  isActiveInSchool: boolean;
  isActiveTeachingInSchool: boolean;
  displayJobTitle: string | null;
  emailAddresses: Array<{ displayName: string; emailAddressType: string }>;
}

/**
 * A student record, combining Arbor's `student` and `person` entities. Fields below
 * are copied from Arbor's own GraphQL docs example query on `Student` — real field
 * names — restricted to ones backed by entities Anaxi actually has permission for.
 * `senStatusAssignments`/`senStatus` (SEND) and `academicYearEnrolments` (roll status)
 * map onto entities we do have (`senStatus`, `senStatusAssignment`,
 * `academicYearEnrolment`); the docs example's `medicalConditions`, `houseMemberships`,
 * `ethnicity`, `religion`, `postalAddressOccupancies` etc. reference entities NOT in
 * entities.ts and are excluded. Pupil Premium and UPN are not shown in the docs'
 * Student example at all — expect them to come from `ukDfe_PupilPremiumRecipient` and
 * `ukDfe_UpnAssignment` as their own queries, not fields on Student (unconfirmed).
 */
export interface ArborStudentRecord {
  id: string;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  dateOfBirth: string | null;
  mostRecentEntryDate: string | null;
  leavingDate: string | null;
  /** Likely the year-group-equivalent field — "displayAcademicLevel" in the docs example, backed by the `academicLevel` entity. */
  displayAcademicLevel: { displayName: string } | null;
  senStatusAssignments: Array<{
    startDate: string | null;
    endDate: string | null;
    senStatus: { code: string; displayName: string } | null;
  }>;
}

/**
 * A class and its roster. CONFIRMED from Arbor's own "Domain Model" docs example
 * (a query on `TeachingGroup`): the real relationship is
 * `TeachingGroup → academicUnitAutomaticEnrolments → academicUnitEnrolments →
 * academicUnit → { subject, sessions, timetableSlots }` — NOT a direct
 * `teachingGroup.timetableSlots` link as earlier groundwork assumed. `academicUnit`
 * (confirmed in entities.ts) is the entity actually carrying the subject and
 * timetable slots; `teachingGroup` is the roster/group identity. Student membership
 * comes via the separate `teachingGroupMembership` entity (confirmed to exist, exact
 * fields unconfirmed).
 */
export interface ArborTeachingGroupRecord {
  id: string;
  teachingGroupName: string;
  academicYear: { code: string; displayName: string } | null;
}

/**
 * A timetable slot, from Arbor's `timetableSlot` entity (confirmed, reached via
 * `academicUnit.timetableSlots` per the TeachingGroup example above, not directly
 * off `teachingGroup`). `timetableSlotStaff` and `timetableSlotLocation`/`location`
 * are confirmed as separate related entities, matching entities.ts. Field names below
 * beyond what the docs example showed (`displayName`, `dayOfWeek`) are still guesses.
 */
export interface ArborTimetableSlotRecord {
  id: string;
  dayOfWeek: number;
  displayName: string | null;
}
