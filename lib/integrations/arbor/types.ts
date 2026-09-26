/**
 * Types for the Arbor MIS integration.
 *
 * PLACEHOLDER — these shapes have not been checked against Arbor's actual REST/GraphQL
 * API. They exist so the rest of the sync scaffolding (credential storage, sync run
 * logging, the admin-facing "connect Arbor" flow) has something concrete to compile
 * against. Replace every field here once we have access to Arbor's Developer Portal
 * docs (https://developers-portal.arbor.sc) or a sandbox school to inspect real
 * responses from. Do not build a real sync against this file as-is.
 */

/** Credentials a school's Arbor connection is stored with (encrypted — see lib/integrationSecrets.ts). */
export interface ArborCredentials {
  /** Arbor's identifier for the connected school site. */
  arborSiteId: string;
  /** However Arbor's Developer Portal actually authenticates partner apps — API key, OAuth token, etc. TBD. */
  apiKey: string;
}

/** A staff record as Arbor would return it. Field names are guesses pending real docs. */
export interface ArborStaffRecord {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
}

/** A student record as Arbor would return it. Field names are guesses pending real docs. */
export interface ArborStudentRecord {
  id: string;
  upn: string | null;
  fullName: string;
  yearGroup: string | null;
  isOnRoll: boolean;
}

/** A single class/timetable slot as Arbor would return it. Field names are guesses pending real docs. */
export interface ArborClassSlotRecord {
  id: string;
  classCode: string;
  subject: string;
  yearGroup: string;
  teacherId: string | null;
  studentIds: string[];
}
