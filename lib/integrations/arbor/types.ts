/**
 * Types for the Arbor MIS integration.
 *
 * Entity NAMES are confirmed — see entities.ts, sourced from Anaxi's actual Arbor
 * permission grant, not a guess. Entity FIELDS are still unknown: nothing below should
 * be read as "this is what Arbor returns." Replace every record shape here once we
 * have Arbor's REST API / GraphQL docs or a sandbox school to inspect real responses
 * from. Do not build a real sync against this file as-is.
 */

export type { ArborReadableEntity } from "./entities";

/** Credentials a school's Arbor connection is stored with (encrypted — see lib/integrationSecrets.ts). */
export interface ArborCredentials {
  /** Arbor's identifier for the connected school site. */
  arborSiteId: string;
  /** However Arbor's Developer Portal actually authenticates partner apps — API key, OAuth token, etc. TBD. */
  apiKey: string;
}

/**
 * A staff record, combining Arbor's `staff` and `person` entities (staff almost
 * certainly extends/references person for name and contact details, per the entity
 * list — unconfirmed). Field names below are guesses pending real docs.
 */
export interface ArborStaffRecord {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
}

/**
 * A student record, combining Arbor's `student` and `person` entities. Field names
 * below are guesses pending real docs. SEND and Pupil Premium are NOT modelled here
 * as flags — they're their own entities (`senStatus`/`senStatusAssignment`,
 * `ukDfe_PupilPremiumRecipient`) and need their own sync step, not a field on this.
 */
export interface ArborStudentRecord {
  id: string;
  upn: string | null;
  fullName: string;
  yearGroup: string | null;
  isOnRoll: boolean;
}

/**
 * A class and its roster, combining Arbor's `teachingGroup` and
 * `teachingGroupMembership` entities. Field names below are guesses pending real docs;
 * what's no longer a guess is that Arbor does have a distinct class/roster concept
 * (confirmed by entities.ts) to sync this from, rather than inferring rosters from
 * timetable slots.
 */
export interface ArborTeachingGroupRecord {
  id: string;
  classCode: string;
  subject: string;
  yearGroup: string;
  tutorStaffId: string | null;
  studentIds: string[];
}

/**
 * A timetable slot, from Arbor's `timetableSlot` entity, referencing a `timetablePeriod`
 * (the bell-times definition) and `timetableSlotLocation`/`timetableSlotStaff`. Field
 * names below are guesses pending real docs.
 */
export interface ArborTimetableSlotRecord {
  id: string;
  teachingGroupId: string;
  periodId: string;
  dayOfWeek: number;
  roomId: string | null;
  staffId: string | null;
}
