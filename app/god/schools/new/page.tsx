import { requireSuperAdminUser } from "@/lib/admin";
import { getCsrfToken } from "@/lib/csrf";
import { CsrfInput } from "@/components/CsrfInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { H1, MetaText } from "@/components/ui/typography";

const DEFAULT_MODULES = [
  "OBSERVATIONS",
  "SIGNALS",
  "STUDENTS",
  "STUDENTS_IMPORT",
  "ON_CALL",
  "MEETINGS",
  "ADMIN",
  "ADMIN_SETTINGS",
  "ANALYSIS",
];

export default async function NewSchoolPage() {
  await requireSuperAdminUser();
  const csrfToken = await getCsrfToken();

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <H1>Create School</H1>
      <MetaText>Creates a new tenant, enables selected modules, and creates initial school admin.</MetaText>

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
            <input name="temporaryPassword" defaultValue="ChangeMe123!" className="field w-full" />
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
            <div className="grid gap-1.5 sm:grid-cols-2">
              {DEFAULT_MODULES.map((m) => (
                <label key={m} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface/60 px-3 py-2 text-sm calm-transition hover:border-accent/30 hover:bg-[var(--accent-tint)]">
                  <input type="checkbox" name="modules" value={m} defaultChecked className="accent-accent" /> {m}
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
