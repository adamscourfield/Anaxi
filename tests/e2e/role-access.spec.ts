import { test, expect, type Page } from "@playwright/test";
import { pageAs } from "./sessions";

/**
 * Who can see what, one demo account per role (npm run seed:demo).
 *
 * Only rules that are settled are pinned here, either in lib/rbac.ts and the page guards or
 * confirmed by the school (marked "decided"). If one of these fails, a change has altered what
 * staff can see: check that it was meant before updating the test.
 */

const USERS = {
  ADMIN: "admin@demo.school",
  SLT: "sarah.chen@demo.school",
  HOD_MATHS: "david.kumar@demo.school",
  LEADER: "hannah.osborne@demo.school",
  TEACHER: "alice.thornton@demo.school",
  SUPPORT: "tom.fielding@demo.school",
} as const;
type Who = keyof typeof USERS;


/** The page opened and shows its own content (not a refusal, a 404 or an error). */
async function expectAllowed(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("#tenant-main")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /page not found/i })).toHaveCount(0);
  await expect(page.getByText(/could not be loaded/i)).toHaveCount(0);
  expect(new URL(page.url()).pathname.startsWith(path)).toBeTruthy();
}

/** The page refused: a 404, the error page, or a redirect elsewhere. Never its real content.
 *  Polled, because some refusals are a client-side redirect that lands after the first paint. */
async function expectBlocked(page: Page, path: string) {
  const response = await page.goto(path);
  const serverRefused = (response?.status() ?? 200) >= 400;
  await expect
    .poll(
      async () => {
        const movedAway = !new URL(page.url()).pathname.startsWith(path);
        const notFound = await page.getByRole("heading", { name: /page not found/i }).count();
        const errorPage = await page.getByText(/could not be loaded/i).count();
        return serverRefused || movedAway || notFound > 0 || errorPage > 0;
      },
      { message: `${path} should be refused`, timeout: 15_000 },
    )
    .toBe(true);
}

function menuLink(page: Page, name: string) {
  return page.locator("nav a").filter({ hasText: new RegExp(`^\\s*${name}`) });
}

test.describe("role access", () => {
  test.describe.configure({ timeout: 180_000 });

  test("admin: administration, insights and the Strategy Board; not the platform console", async ({ browser }) => {
    const { page, close } = await pageAs(browser, USERS.ADMIN);
    try {
      await expectAllowed(page, "/admin");
      await expectAllowed(page, "/insights/attainment");
      await expectAllowed(page, "/strategy");
      await expectBlocked(page, "/god");
    } finally {
      await close();
    }
  });

  test("senior leader: insights and the Strategy Board, but not administration", async ({ browser }) => {
    const { page, close } = await pageAs(browser, USERS.SLT);
    try {
      await expectAllowed(page, "/insights/attainment");
      await expectAllowed(page, "/strategy");
      await expectBlocked(page, "/admin");
      await expect(menuLink(page, "Administration")).toHaveCount(0);
    } finally {
      await close();
    }
  });

  test("teacher: own work areas, no insights, Strategy Board or administration", async ({ browser }) => {
    const { page, close } = await pageAs(browser, USERS.TEACHER);
    try {
      await expectAllowed(page, "/home");
      await expectAllowed(page, "/my-actions");
      await expectAllowed(page, "/observe/new");
      await expectBlocked(page, "/insights/attainment");
      await expectBlocked(page, "/strategy");
      await expectBlocked(page, "/admin");
      await page.goto("/home");
      await expect(menuLink(page, "Strategy Board")).toHaveCount(0);
      await expect(menuLink(page, "Administration")).toHaveCount(0);
    } finally {
      await close();
    }
  });

  test("teacher cannot change grades, even by calling the server directly", async ({ browser }) => {
    const { page, close } = await pageAs(browser, USERS.TEACHER);
    try {
      const res = await page.request.post("/api/assessments/points/any-point/grid", {
        data: { yearGroup: "Y11", gradeFormat: "GCSE", subjects: ["Maths"], entries: [] },
      });
      expect([401, 403]).toContain(res.status());
    } finally {
      await close();
    }
  });

  test("leader (decided 26 Nov): meetings and my actions, like a teacher; no insights", async ({ browser }) => {
    const { page, close } = await pageAs(browser, USERS.LEADER);
    try {
      await expectAllowed(page, "/my-actions");
      await expectAllowed(page, "/meetings");
      await expectBlocked(page, "/insights/attainment");
      await expectBlocked(page, "/strategy");
    } finally {
      await close();
    }
  });

  test("head of department (decided 27 Nov): value-added only for teachers in their own departments", async ({ browser }) => {
    const { page, close } = await pageAs(browser, USERS.HOD_MATHS);
    try {
      await expectAllowed(page, "/insights/attainment/teacher-evidence");
      const departmentCells = page.locator("table").first().locator("tbody tr td:first-child");
      await expect(departmentCells.first()).toBeVisible({ timeout: 30_000 });
      const rows = await departmentCells.allInnerTexts();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row, "every teacher listed is in Maths").toMatch(/Maths/);

      const csv = await (await page.request.post("/api/explorer/export", { form: { view: "ASSESSMENT_TEACHERS" } })).text();
      const departments = csv
        .split("\n")
        .filter((line) => line && !line.startsWith("#") && !line.startsWith('"Teacher"') && !line.startsWith("Teacher"))
        .map((line) => line.split(",")[1] ?? "");
      expect(departments.length).toBeGreaterThan(0);
      for (const d of departments) expect(d).toMatch(/Maths/);
    } finally {
      await close();
    }
  });

  test("on call (decided 26 and 27 Nov): every member of staff sees the whole school; only on-call roles get the menu count", async ({ browser }) => {
    const waitingFor = async (who: Who) => {
      const { page, close } = await pageAs(browser, USERS[who]);
      await expectAllowed(page, "/on-call");
      // .first(): the page refreshes itself, and mid-refresh the list can briefly be in the DOM twice.
      const waiting = page.locator('[aria-labelledby="oncall-waiting"]').first();
      await expect(waiting).toBeVisible({ timeout: 30_000 });
      const names = (await waiting.innerText()).match(/[A-Z][a-z]+ [A-Z][a-z]+/g) ?? [];
      const badge = (await menuLink(page, "On call").first().innerText()).match(/\d+/)?.[0] ?? null;
      await close();
      return { people: new Set(names), badge };
    };
    const admin = await waitingFor("ADMIN");
    const teacher = await waitingFor("TEACHER");
    const support = await waitingFor("SUPPORT");

    // Same call-outs, raised by several different people, for the admin and for staff.
    expect(admin.people.size).toBeGreaterThan(1);
    expect([...teacher.people].sort()).toEqual([...admin.people].sort());
    expect([...support.people].sort()).toEqual([...admin.people].sort());

    expect(admin.badge).not.toBeNull();
    expect(teacher.badge).toBeNull();
    expect(support.badge).toBeNull();
  });
});
