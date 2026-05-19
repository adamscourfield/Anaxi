import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";
import { SectionHeader } from "@/components/ui/section-header";
import { TimetableImportMapper } from "@/components/timetable/TimetableImportMapper";

export default async function AdminTimetablePage() {
  const user = await requireAdminUser();

  const lastJob = await (prisma as any).timetableImportJob.findFirst({
    where: { tenantId: user.tenantId, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
  });

  const entryCount = await (prisma as any).timetableEntry.count({ where: { tenantId: user.tenantId } });

  const unknownTeacherCount = await (prisma as any).timetableEntry.count({
    where: {
      tenantId: user.tenantId,
      teacherUserId: null,
      teacherEmailRaw: { not: null },
    },
  });

  const recentEntries = await (prisma as any).timetableEntry.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      classCode: true,
      subject: true,
      yearGroup: true,
      teacherEmailRaw: true,
      room: true,
      dayOfWeek: true,
      period: true,
      teacherUserId: true,
    },
  });

  return (
    <div className="space-y-4">
      <AdminPageChrome area="Timetable" title="Timetable" subtitle="Import timetable CSVs, resolve mappings, and inspect the latest entries." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-3xl font-bold text-text">{entryCount}</div>
          <div className="mt-1 text-sm text-muted">Total entries</div>
        </Card>
        <Card>
          <div className="text-3xl font-bold text-warning">{unknownTeacherCount}</div>
          <div className="mt-1 text-sm text-muted">Unknown teacher emails</div>
        </Card>
        <Card>
          {lastJob ? (
            <>
              <div className="text-sm font-medium text-text">Last updated: {new Date(lastJob.finishedAt ?? lastJob.createdAt).toLocaleString()}</div>
              <div className="mt-1 text-sm text-muted">{lastJob.rowsProcessed} imported, {lastJob.rowsFailed} failed</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {lastJob.errorReportJson && (
                  <a href={`/api/admin/timetable/import/jobs/${lastJob.id}/errors.csv`} download className="link-accent text-xs">
                    Download error report
                  </a>
                )}
                {lastJob.conflictsJson && (
                  <a href={`/api/admin/timetable/import/jobs/${lastJob.id}/conflicts.csv`} download className="link-accent text-xs">
                    Download conflict report
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted">No imports yet</div>
          )}
        </Card>
      </div>

      <TimetableImportMapper />

      <Card className="overflow-hidden p-0">
        <div className="p-4 pb-0">
          <SectionHeader title="Timetable entries" subtitle={`Latest ${recentEntries.length} row${recentEntries.length === 1 ? "" : "s"}`} />
        </div>
        {recentEntries.length === 0 ? (
          <div className="p-4"><EmptyState title="No timetable entries" description="Import a timetable file to populate this view." /></div>
        ) : (
          <div className="overflow-x-auto p-4 pt-3">
            <div className="table-shell">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head-row text-left">
                    <th className="px-5 py-3.5">Class code</th>
                    <th className="px-4 py-3.5">Subject</th>
                    <th className="px-4 py-3.5">Year</th>
                    <th className="px-4 py-3.5">Teacher email</th>
                    <th className="px-4 py-3.5">Day</th>
                    <th className="px-4 py-3.5">Period</th>
                    <th className="px-4 py-3.5">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentEntries as any[]).map((entry: any) => (
                    <tr key={entry.id} className="table-row calm-transition">
                      <td className="px-5 py-3">{entry.classCode}</td>
                      <td className="px-4 py-3">{entry.subject}</td>
                      <td className="px-4 py-3">{entry.yearGroup}</td>
                      <td className="px-4 py-3">
                        {entry.teacherEmailRaw ?? "—"}
                        {!entry.teacherUserId && entry.teacherEmailRaw && (
                          <span className="ml-1 text-xs text-warning">(unmatched)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{entry.dayOfWeek ?? "—"}</td>
                      <td className="px-4 py-3">{entry.period ?? "—"}</td>
                      <td className="px-4 py-3">{entry.room ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
