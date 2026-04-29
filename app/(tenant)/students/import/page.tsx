import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { batchArchiveYearGroupAction, promoteYearGroupsAction } from "../actions";

const COLUMN_GUIDE = [
  { field: "UPN", required: true, description: "Unique Pupil Number (8-character code)", example: "A123456789" },
  { field: "Name", required: true, description: "Student full name", example: "Jane Smith" },
  { field: "YearGroup", required: true, description: "Year group label", example: "Year 10" },
  { field: "Attendance", required: false, description: "Attendance percentage (0–100)", example: "94.5" },
  { field: "Detentions", required: false, description: "Detention count for the period", example: "3" },
  { field: "InternalExclusions", required: false, description: "Internal exclusion count", example: "1" },
  { field: "Suspensions", required: false, description: "Suspension count", example: "0" },
  { field: "OnCalls", required: false, description: "On-call count for the period", example: "2" },
  { field: "Lateness", required: false, description: "Lateness count", example: "4" },
  { field: "PositivePointsTotal", required: false, description: "Total positive behaviour points", example: "12" },
  { field: "SEND", required: false, description: "SEND flag — TRUE or FALSE", example: "TRUE" },
  { field: "PP", required: false, description: "Pupil Premium flag — TRUE or FALSE", example: "FALSE" },
  { field: "Status", required: false, description: "Student status — leave blank for ACTIVE", example: "ACTIVE" },
];

const DEFAULT_MAPPING = JSON.stringify(
  Object.fromEntries(COLUMN_GUIDE.map(({ field }) => [field, field])),
  null, 2
);

export default async function StudentsImportPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  const canWriteStudents = hasPermission(user.role, "students:write");

  const activeYearGroupsRaw = await (prisma as any).student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE", yearGroup: { not: null } },
    select: { yearGroup: true },
    distinct: ["yearGroup"],
    orderBy: { yearGroup: "asc" },
  });
  const activeYearGroups = (activeYearGroupsRaw as Array<{ yearGroup: string | null }>)
    .map((r) => r.yearGroup)
    .filter((v): v is string => Boolean(v));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Import Student Snapshots"
        subtitle="Upload a CSV file of behaviour data for a given date. Each row is one student."
      />

      <Card className="space-y-4">
        <SectionHeader title="Cohort management" subtitle="Archive leavers or roll year groups forward without deleting historical records." />
        {canWriteStudents ? (
          <div className="grid gap-4 md:grid-cols-2">
            <form action={batchArchiveYearGroupAction} className="space-y-2 rounded-xl border border-border/40 bg-bg/40 p-4">
              <h3 className="text-sm font-semibold text-text">Batch archive by year group</h3>
              <p className="text-xs text-muted">
                Archived students are hidden from on-call pickers and active cohort views, but retain all past snapshots and assessment links.
              </p>
              <input
                name="yearGroup"
                className="field w-full"
                list="active-year-groups"
                placeholder="e.g. Year 11"
                required
              />
              <datalist id="active-year-groups">
                {activeYearGroups.map((yg) => (
                  <option key={yg} value={yg} />
                ))}
              </datalist>
              <Button type="submit" variant="secondary" className="w-full">Archive cohort</Button>
            </form>

            <form action={promoteYearGroupsAction} className="space-y-2 rounded-xl border border-border/40 bg-bg/40 p-4">
              <h3 className="text-sm font-semibold text-text">Batch promote year groups</h3>
              <p className="text-xs text-muted">
                Moves active students up one year (e.g. Year 7 → Year 8, Y10 → Y11) and archives students in the current highest year group.
              </p>
              <Button type="submit" className="w-full">Promote all active cohorts</Button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-muted">You do not have permission to run cohort management actions.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <SectionHeader title="CSV column guide" subtitle="Your CSV file must have a header row. Column names must match exactly (case-sensitive)." />
        <div className="overflow-x-auto">
          <div className="table-shell">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-5 py-3.5">Column name</th>
                  <th className="px-4 py-3.5 text-center">Required</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5 text-muted">Example</th>
                </tr>
              </thead>
              <tbody>
                {COLUMN_GUIDE.map(({ field, required, description, example }) => (
                  <tr key={field} className="table-row calm-transition">
                    <td className="px-5 py-3 font-mono text-[12px] font-semibold text-accent">{field}</td>
                    <td className="px-4 py-3 text-center">
                      {required ? (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-error align-middle" title="Required" />
                      ) : (
                        <span className="text-xs text-muted">opt.</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{description}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-muted">{example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted">
          If your CSV uses different column names, edit the mapping below to map each field to your actual column header.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/import/csv/template" className="link-accent text-xs font-medium">
            Download blank behaviour template
          </a>
          <a href="/api/import/csv/template?prefill=1" className="link-accent text-xs font-medium">
            Download pre-populated behaviour template
          </a>
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionHeader title="Upload file" />
        <form action="/api/students/import" method="post" encType="multipart/form-data" className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-text">CSV file</label>
            <input type="file" name="file" accept=".csv" required className="block text-sm text-text file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text">Snapshot date</label>
            <input type="date" name="snapshotDate" className="field" required />
            <p className="text-xs text-muted">The date this data was captured (e.g. end of half-term).</p>
          </div>
          <details className="rounded-lg border border-border bg-bg p-3 text-sm">
            <summary className="cursor-pointer font-medium text-muted">Advanced: column name mapping</summary>
            <p className="mt-2 text-xs text-muted">Only edit this if your CSV columns have different names to those shown above. The keys (left side) are fixed field names — only change the values (right side) to match your CSV headers.</p>
            <textarea
              name="mappingJson"
              className="field mt-2 h-48 w-full font-mono text-xs"
              defaultValue={DEFAULT_MAPPING}
            />
          </details>
          <Button type="submit">Upload and process</Button>
        </form>
      </Card>
    </div>
  );
}
