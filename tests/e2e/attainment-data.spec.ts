import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { contextAs } from "./sessions";

/**
 * Attainment data: the things that went wrong in practice.
 * Runs against the demo seed (npm run seed:demo) as the demo admin, and puts back anything it changes.
 */

const ADMIN = "admin@demo.school";

type Cycle = { id: string; label: string; points: Array<{ id: string; label: string }> };

async function year11Mock(request: APIRequestContext) {
  const res = await request.get("/api/assessments/cycles");
  expect(res.ok()).toBeTruthy();
  const { cycles } = (await res.json()) as { cycles: Cycle[] };
  const cycle = cycles.find((c) => c.label.startsWith("Year 11"));
  expect(cycle, "demo seed has a Year 11 GCSE cycle").toBeTruthy();
  const point = cycle!.points.find((p) => p.label === "Mock 1") ?? cycle!.points[0];
  return { cycleId: cycle!.id, pointId: point.id };
}

type Grid = {
  students: Array<{ id: string; fullName: string; upn: string | null; yearGroup: string }>;
  values: Record<string, Record<string, string>>;
  assessments: Array<{ subject: string; yearGroup: string; gradeFormat: string }>;
};

async function loadGrid(request: APIRequestContext, pointId: string): Promise<Grid> {
  const res = await request.get(`/api/assessments/points/${pointId}/grid`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe("attainment data", () => {
  test.describe.configure({ timeout: 180_000 });
  // Every test runs as the demo admin, signed in once (see ./sessions).
  let page: Page;
  test.beforeEach(async ({ browser }) => {
    page = await (await contextAs(browser, ADMIN)).newPage();
  });
  test.afterEach(async () => {
    await page.context().close();
  });

  test("uploading the same subject twice updates it instead of adding a duplicate", async () => {
    const { pointId } = await year11Mock(page.request);
    const grid = await loadGrid(page.request, pointId);
    const biology = grid.assessments.find((a) => a.subject === "Biology");
    test.skip(!biology, "no Biology results at this point in the seed");
    const taker = grid.students.find((s) => s.upn && grid.values[s.id]?.Biology);
    expect(taker).toBeTruthy();
    const original = grid.values[taker!.id].Biology;
    const countBiology = async () => (await loadGrid(page.request, pointId)).assessments.filter((a) => a.subject === "Biology").length;
    const before = await countBiology();

    const upload = (grade: string) =>
      page.request.post(`/api/assessments/points/${pointId}/upload`, {
        multipart: {
          // Typed the way staff do; stored as "Y11". Before the fix this created a second Biology.
          yearGroup: "Year 11",
          gradeFormat: "GCSE",
          subjects: "Biology",
          file: { name: "biology.csv", mimeType: "text/csv", buffer: Buffer.from(`Name,UPN,Biology\n${taker!.fullName},${taker!.upn},${grade}\n`) },
        },
      });
    try {
      const changed = original === "9" ? "8" : "9";
      expect((await upload(changed)).status()).toBe(201);
      expect((await upload(changed)).status()).toBe(201);
      expect(await countBiology()).toBe(before);
      expect((await loadGrid(page.request, pointId)).values[taker!.id].Biology).toBe(changed);
    } finally {
      await upload(original);
    }
  });

  test("the pre-filled template lists the year group's students", async () => {
    const res = await page.request.get("/api/assessments/template?yearGroup=Year%2011&subjects=Maths");
    expect(res.ok()).toBeTruthy();
    const rows = (await res.text()).trim().split("\n");
    expect(rows.length).toBeGreaterThan(50); // header + every Year 11 student, not an empty sheet
  });

  test("grade entry: invalid grades save nothing, cleared cells remove the grade", async () => {
    const { pointId } = await year11Mock(page.request);
    const grid = await loadGrid(page.request, pointId);
    const maths = grid.assessments.find((a) => a.subject === "Maths")!;
    const [a, b] = grid.students.filter((s) => grid.values[s.id]?.Maths && /^[1-9]$/.test(grid.values[s.id].Maths));
    const originalA = grid.values[a.id].Maths;
    const originalB = grid.values[b.id].Maths;
    const save = (entries: Array<{ id: string; value: string }>) =>
      page.request.post(`/api/assessments/points/${pointId}/grid`, {
        data: {
          mode: "changes",
          yearGroup: maths.yearGroup,
          gradeFormat: maths.gradeFormat,
          subjects: ["Maths"],
          entries: entries.map(({ id, value }) => {
            const s = grid.students.find((x) => x.id === id)!;
            return { studentId: s.id, upn: s.upn ?? "", studentName: s.fullName, values: { Maths: value } };
          }),
        },
      });

    try {
      // One bad grade in the batch: nothing is saved, including the good one.
      const changedA = originalA === "9" ? "8" : "9";
      const bad = await save([{ id: a.id, value: changedA }, { id: b.id, value: "10" }]);
      expect(bad.status()).toBe(400);
      expect((await loadGrid(page.request, pointId)).values[a.id].Maths).toBe(originalA);

      // A cleared cell removes the grade.
      expect((await save([{ id: b.id, value: "" }])).ok()).toBeTruthy();
      expect((await loadGrid(page.request, pointId)).values[b.id]?.Maths).toBeUndefined();
    } finally {
      await save([{ id: a.id, value: originalA }, { id: b.id, value: originalB }]);
    }
    const restored = await loadGrid(page.request, pointId);
    expect(restored.values[a.id].Maths).toBe(originalA);
    expect(restored.values[b.id].Maths).toBe(originalB);
  });

  test("result points have three statuses: Draft, Published, Locked", async () => {
    const { cycleId, pointId } = await year11Mock(page.request);
    await page.goto(`/assessments/${cycleId}`);
    const status = page.getByLabel(/^Status of /).first();
    await expect(status).toBeVisible({ timeout: 30_000 });
    const options = await status.locator("option").allInnerTexts();
    expect(options.join(" ")).not.toMatch(/validated/i);

    // An old page that still sends "Validated" is treated as Published.
    const patch = await page.request.patch(`/api/assessments/points/${pointId}`, { data: { resultStatus: "VALIDATED" } });
    expect(patch.ok()).toBeTruthy();
    expect((await patch.json()).point.resultStatus).toBe("PUBLISHED");
    expect((await page.request.patch(`/api/assessments/points/${pointId}`, { data: { resultStatus: "NOPE" } })).status()).toBe(400);
  });
});
