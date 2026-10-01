import type { ArborCredentials } from "./types";

/**
 * PLACEHOLDER client for Arbor's REST/GraphQL API.
 *
 * Deliberately unimplemented: we have partner access to Arbor but not yet the
 * Developer Portal API docs (https://developers-portal.arbor.sc) or a sandbox school
 * to build and test real requests against. Every method here throws rather than
 * pretending to talk to Arbor, so a caller finds out immediately if this gets wired
 * into a real sync before it's ready, instead of silently no-oping or returning fake
 * data.
 *
 * When the docs arrive, replace this with real HTTP calls (see modules/staff-import
 * and modules/students for the shape a sync step should end up producing — an array
 * of parsed rows plus per-row errors) and keep credentials flowing through
 * decryptCredentials() (lib/integrationSecrets.ts), never logged or returned as-is.
 */
export class ArborClient {
  constructor(private readonly credentials: ArborCredentials) {}

  async listStaff(): Promise<never> {
    throw new Error("ArborClient.listStaff is not implemented — pending Arbor API docs.");
  }

  async listStudents(): Promise<never> {
    throw new Error("ArborClient.listStudents is not implemented — pending Arbor API docs.");
  }

  async listClassSlots(): Promise<never> {
    throw new Error("ArborClient.listClassSlots is not implemented — pending Arbor API docs.");
  }
}
