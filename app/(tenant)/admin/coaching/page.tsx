import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export default async function AdminCoachingPage({
  searchParams,
}: {
  searchParams?: { coach?: string; coachee?: string };
}) {
  const user = await requireAdminUser();

  const allUsers = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const assignments = await (prisma as any).coachAssignment.findMany({
    where: { tenantId: user.tenantId },
    include: {
      coach: { select: { id: true, fullName: true } },
      coachee: { select: { id: true, fullName: true } },
    },
    orderBy: [{ coachUserId: "asc" }],
  });

  async function addAssignment(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const coachUserId = String(formData.get("coachUserId") || "");
    const coacheeUserId = String(formData.get("coacheeUserId") || "");
    if (!coachUserId || !coacheeUserId || coachUserId === coacheeUserId) return;
    await (prisma as any).coachAssignment.upsert({
      where: { tenantId_coachUserId_coacheeUserId: { tenantId: admin.tenantId, coachUserId, coacheeUserId } },
      update: {},
      create: { tenantId: admin.tenantId, coachUserId, coacheeUserId },
    });
    revalidatePath("/admin/coaching");
  }

  async function removeAssignment(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const coachUserId = String(formData.get("coachUserId"));
    const coacheeUserId = String(formData.get("coacheeUserId"));
    await (prisma as any).coachAssignment.deleteMany({
      where: { tenantId: admin.tenantId, coachUserId, coacheeUserId },
    });
    revalidatePath("/admin/coaching");
  }

  const assignmentList = assignments as any[];

  // Filter by search params
  const filterCoach = searchParams?.coach?.toLowerCase() ?? "";
  const filterCoachee = searchParams?.coachee?.toLowerCase() ?? "";
  const filtered = assignmentList.filter((a) => {
    const coachName = (a.coach?.fullName ?? "").toLowerCase();
    const coacheeName = (a.coachee?.fullName ?? "").toLowerCase();
    return (
      (!filterCoach || coachName.includes(filterCoach)) &&
      (!filterCoachee || coacheeName.includes(filterCoachee))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader variant="ledger"
        title="Coaching Assignments"
        subtitle="Manage coach-to-coachee pairs across your institution."
      />

      {/* ── Add Assignment ───────────────────────────────────────────── */}
      <Card>
        <SectionHeader
          title="New assignment"
          subtitle="Select a coach and a coachee to create a new coaching pair."
        />
        <form action={addAssignment} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              Coach
            </label>
            <select
              name="coachUserId"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/30"
              required
            >
              <option value="">Select coach…</option>
              {(allUsers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              Coachee
            </label>
            <select
              name="coacheeUserId"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/30"
              required
            >
              <option value="">Select coachee…</option>
              {(allUsers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
          <div className="pb-0.5">
            <Button type="submit" className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10 4v12M4 10h12" />
              </svg>
              Add Assignment
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Filters + Table ──────────────────────────────────────────── */}
      {assignmentList.length === 0 ? (
        <EmptyState title="No coaching assignments yet" description="Create your first coach/coachee pair using the form above." />
      ) : (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="filter-panel">
          <form className="filter-bar items-end" method="get">
            <label className="flex min-w-[200px] max-w-xs flex-1 flex-col gap-1.5">
              <span className="filter-field-label">Coach</span>
              <div className="relative">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="8.5" cy="8.5" r="4.5" />
                  <path d="M14 14l3 3" />
                </svg>
                <input
                  name="coach"
                  defaultValue={searchParams?.coach ?? ""}
                  placeholder="Filter by coach…"
                  className="field field-filter-trigger w-full py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
            </label>
            <label className="flex min-w-[200px] max-w-xs flex-1 flex-col gap-1.5">
              <span className="filter-field-label">Coachee</span>
              <div className="relative">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="8.5" cy="8.5" r="4.5" />
                  <path d="M14 14l3 3" />
                </svg>
                <input
                  name="coachee"
                  defaultValue={searchParams?.coachee ?? ""}
                  placeholder="Filter by coachee…"
                  className="field field-filter-trigger w-full py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
            </label>
            <div className="filter-actions filter-actions--inline !ml-0 w-full sm:w-auto lg:ml-0">
              <button type="submit" className="btn-filter-primary btn-filter-primary--compact">
                Filter
              </button>
              {(filterCoach || filterCoachee) && (
                <a href="/admin/coaching" className="btn-filter-secondary btn-filter-secondary--compact text-center no-underline">
                  Clear
                </a>
              )}
            </div>
          </form>
          </div>

          {/* Table */}
          <div className="table-shell">
            <div className="table-head-row grid grid-cols-[1fr_1fr_100px] items-center px-6 py-3">
              <span>Coach</span>
              <span>Coachee</span>
              <span className="text-center">Actions</span>
            </div>

            {filtered.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted">
                No assignments match your filters.
              </div>
            ) : (
              filtered.map((a: any) => (
                <div
                  key={`${a.coachUserId}-${a.coacheeUserId}`}
                  className="table-row grid grid-cols-[1fr_1fr_100px] items-center px-6 py-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={a.coach?.fullName ?? "?"} size="md" />
                    <span className="text-sm font-medium text-text">{a.coach?.fullName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar name={a.coachee?.fullName ?? "?"} size="md" />
                    <span className="text-sm text-text">{a.coachee?.fullName}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <form action={removeAssignment}>
                      <input type="hidden" name="coachUserId" value={a.coachUserId} />
                      <input type="hidden" name="coacheeUserId" value={a.coacheeUserId} />
                      <button
                        type="submit"
                        className="rounded-md p-1.5 text-muted calm-transition hover:bg-error/10 hover:text-error"
                        title="Remove assignment"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 6h12M8 6V4h4v2M6 6v10a1 1 0 001 1h6a1 1 0 001-1V6" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between border-t border-[var(--surface-container-low)] px-6 py-3">
              <p className="text-sm text-muted">
                Showing{" "}
                <span className="font-semibold text-text">{filtered.length}</span>
                {filtered.length !== assignmentList.length && (
                  <> of <span className="font-semibold text-text">{assignmentList.length}</span></>
                )}{" "}
                assignment{assignmentList.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
