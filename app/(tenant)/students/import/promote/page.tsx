import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { SelectivePromotionForm } from "./SelectivePromotionForm";

function incrementYearGroupLabel(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/(\d{1,2})/);
  if (!match) return null;

  const current = Number(match[1]);
  if (!Number.isFinite(current) || current >= 13) return null;

  const next = String(current + 1);
  return trimmed.replace(match[1], next);
}

export default async function SelectivePromotionPage({
  searchParams,
}: {
  searchParams: Promise<{ yearGroup?: string }>;
}) {
  const { yearGroup: rawYearGroup } = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  const canWriteStudents = hasPermission(user.role, "students:write");

  const yearGroup = rawYearGroup?.trim() || "";

  const activeYearGroupsRaw = await (prisma as any).student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE", yearGroup: { not: null } },
    select: { yearGroup: true },
    distinct: ["yearGroup"],
    orderBy: { yearGroup: "asc" },
  });
  const activeYearGroups = (activeYearGroupsRaw as Array<{ yearGroup: string | null }>)
    .map((r) => r.yearGroup)
    .filter((v): v is string => Boolean(v));

  const nextYearGroup = yearGroup ? incrementYearGroupLabel(yearGroup) : null;

  const students = yearGroup
    ? ((await (prisma as any).student.findMany({
        where: { tenantId: user.tenantId, status: "ACTIVE", yearGroup },
        select: { id: true, fullName: true, upn: true },
        orderBy: { fullName: "asc" },
      })) as Array<{ id: string; fullName: string; upn: string | null }>)
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader variant="ledger"
        title="Selective promotion"
        subtitle="For a mixed cohort where only some students continue into the next year group — everyone else in this year group is archived as a leaver."
      />

      {!canWriteStudents ? (
        <Card>
          <p className="text-sm text-muted">You do not have permission to run cohort management actions.</p>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <form method="get" className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Year group</span>
                <input
                  name="yearGroup"
                  className="field"
                  list="active-year-groups"
                  defaultValue={yearGroup}
                  placeholder="e.g. Year 11"
                  required
                />
                <datalist id="active-year-groups">
                  {activeYearGroups.map((yg) => (
                    <option key={yg} value={yg} />
                  ))}
                </datalist>
              </label>
              <Button type="submit" variant="secondary">Load students</Button>
            </form>
          </Card>

          {yearGroup && !nextYearGroup ? (
            <Card>
              <p className="text-sm text-muted">
                {yearGroup} cannot be promoted further — use batch archive instead if this cohort is leaving.
              </p>
            </Card>
          ) : null}

          {yearGroup && nextYearGroup ? (
            <Card className="space-y-4">
              {students.length === 0 ? (
                <p className="text-sm text-muted">No active students found in {yearGroup}.</p>
              ) : (
                <SelectivePromotionForm
                  yearGroup={yearGroup}
                  nextYearGroup={nextYearGroup}
                  students={students}
                />
              )}
            </Card>
          ) : null}
        </>
      )}

      <Link href="/students/import" className="link-accent text-xs font-medium">
        ← Back to import and cohort management
      </Link>
    </div>
  );
}
