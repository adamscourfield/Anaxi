import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/integrations/arbor/graphqlClient", () => ({ runArborGraphqlQuery: mocks.query }));
import { ArborClient } from "@/lib/integrations/arbor/client";
it("reads final statutory roll-call marks with inclusive date boundaries, excluding lesson records", async () => {
  mocks.query.mockResolvedValue({ AttendanceRollCallRecord: [] });
  const client = new ArborClient({ schoolHostname: "example", username: "test", password: "test" });
  await client.listAllStatutoryAttendanceRecords("2026-10-01", "2026-10-02");
  const query = mocks.query.mock.calls[0][1];
  expect(query).toContain('AttendanceRollCallRecord(page_size: 500, page_num: 0, recordDate_after_or_equal: "2026-10-01", recordDate_before: "2026-10-02")');
  expect(query).toContain("attendanceRollCall { id code }");
  expect(query).not.toContain("AttendanceRecord(");
});
