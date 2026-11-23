import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import styles from "@/app/god/god.module.css";
import { requireSuperAdminUser } from "@/lib/admin";
import { getCsrfToken } from "@/lib/csrf";
import { CsrfInput } from "@/components/CsrfInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { H1, MetaText } from "@/components/ui/typography";

/** Every module a school can have. Leave, Timetable, Student Analysis and Assessments were
 *  previously missing here, so they could only be switched on after the school was created. */
const ALL_MODULES = [
  "OBSERVATIONS",
  "SIGNALS",
  "STUDENTS",
  "STUDENTS_IMPORT",
  "LEAVE",
  "ON_CALL",
  "STRATEGY",
  "MEETINGS",
  "TIMETABLE",
  "ADMIN",
  "ADMIN_SETTINGS",
  "ANALYSIS",
  "STUDENT_ANALYSIS",
  "ASSESSMENTS",
] as const;

/** Ticked by default when creating a school (unchanged). */
const DEFAULT_MODULES = new Set<string>([
  "OBSERVATIONS",
  "SIGNALS",
  "STUDENTS",
  "STUDENTS_IMPORT",
  "ON_CALL",
  "STRATEGY",
  "MEETINGS",
  "ADMIN",
  "ADMIN_SETTINGS",
  "ANALYSIS",
]);

export default async function NewSchoolPage() {
  await requireSuperAdminUser();
  const csrfToken = await getCsrfToken();

  return (
    <div className={styles.page}>
      <Link href="/god" className={styles.backLink}>← Schools</Link>
      <PageHeader variant="ledger" title="Create school" subtitle="School details, initial administrator and enabled modules."/>

      <Card>
        <form method="post" action="/api/god/schools" className="space-y-4">
          <CsrfInput token={csrfToken} />
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">School name</span>
            <input required name="name" className="field w-full" placeholder="Riverdale Academy" />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">School slug</span>
            <input name="slug" className="field w-full" placeholder="riverdale-academy" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Admin full name</span>
              <input required name="adminName" className="field w-full" placeholder="Alex Morgan" />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Admin email</span>
              <input required type="email" name="adminEmail" className="field w-full" placeholder="admin@riverdale.sch.uk" />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Temporary admin password</span>
            <input type="password" autoComplete="new-password" name="temporaryPassword" defaultValue="ChangeMe123!" className="field w-full" />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">School type</span>
            <select name="schoolType" defaultValue="SECONDARY" className="field w-full">
              <option value="SECONDARY">Secondary</option>
              <option value="PRIMARY">Primary</option>
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Enable modules</legend>
            <div className={styles.moduleGrid}>
              {ALL_MODULES.map((m) => (
                <label key={m} className="flex items-center gap-2.5 rounded-[10px] border border-[#e5e5e6] bg-white px-3 py-2.5 text-sm calm-transition hover:bg-[#fafafa]">
                  <input type="checkbox" name="modules" value={m} defaultChecked={DEFAULT_MODULES.has(m)} /> {m.toLowerCase().split("_").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit">Create school</Button>
        </form>
      </Card>
    </div>
  );
}
