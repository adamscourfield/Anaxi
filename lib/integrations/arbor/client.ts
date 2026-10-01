import type { ArborCredentials } from "./types";

/**
 * PLACEHOLDER client for Arbor's REST/GraphQL API.
 *
 * We now have Anaxi's confirmed, read-only entity grant (see entities.ts) but not yet
 * the REST API / GraphQL reference itself or a sandbox school to build and test real
 * requests against. Every method here throws rather than pretending to talk to Arbor,
 * so a caller finds out immediately if this gets wired into a real sync before it's
 * ready, instead of silently no-oping or returning fake data.
 *
 * When the docs arrive, replace this with real HTTP calls (see modules/staff-import
 * and modules/students for the shape a sync step should end up producing — an array
 * of parsed rows plus per-row errors) and keep credentials flowing through
 * decryptCredentials() (lib/integrationSecrets.ts), never logged or returned as-is.
 * There is no write path to build here — the grant is read-only on every entity.
 */
export class ArborClient {
  constructor(private readonly credentials: ArborCredentials) {}

  async listStaff(): Promise<never> {
    throw new Error(
      "ArborClient.listStaff is not implemented — entity names (staff, person) are " +
        "confirmed, but field shapes and the endpoint itself are pending Arbor's REST/GraphQL docs."
    );
  }

  async listStudents(): Promise<never> {
    throw new Error(
      "ArborClient.listStudents is not implemented — entity names (student, person, " +
        "senStatus, ukDfe_PupilPremiumRecipient) are confirmed, but field shapes and the " +
        "endpoint itself are pending Arbor's REST/GraphQL docs."
    );
  }

  async listTeachingGroups(): Promise<never> {
    throw new Error(
      "ArborClient.listTeachingGroups is not implemented — entity names (teachingGroup, " +
        "teachingGroupMembership, teachingGroupTutor) are confirmed, but field shapes and " +
        "the endpoint itself are pending Arbor's REST/GraphQL docs."
    );
  }

  async listTimetableSlots(): Promise<never> {
    throw new Error(
      "ArborClient.listTimetableSlots is not implemented — entity names (timetablePeriod, " +
        "timetableSlot, timetableSlotLocation, timetableSlotStaff) are confirmed, but field " +
        "shapes and the endpoint itself are pending Arbor's REST/GraphQL docs."
    );
  }
}
