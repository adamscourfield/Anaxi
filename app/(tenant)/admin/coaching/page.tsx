import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";

const CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

const LABEL =
  "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]";

const ICON_WELL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5] [&_svg]:shrink-0";

const FIELD =
  "w-full min-h-[2.75rem] rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#CBD5E1] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

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

  const hasFilters = Boolean(filterCoach || filterCoachee);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        variant="ledger"
        title="Coaching Assignments"
        titleClassName="!text-[#111827]"
        subtitleClassName="anx-page-subtitle !text-[#6B7280]"
        subtitle="Manage coach-to-coachee pairs across your institution."
      />

      {/* New assignment */}
      <div className={CARD}>
        <div className="border-b border-[#E5E7EB] px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex gap-3 sm:gap-4">
            <span className={ICON_WELL} aria-hidden>
              <PlusIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-[#111827]">New assignment</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
                Select a coach and a coachee to create a new coaching pair.
              </p>
            </div>
          </div>
        </div>
        <form action={addAssignment} className="flex flex-col gap-4 px-6 py-7 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-4 sm:px-8 sm:pb-8">
          <label className="min-w-0 flex-1 sm:min-w-[200px]">
            <span className={LABEL}>Coach</span>
            <select name="coachUserId" className={FIELD} required defaultValue="">
              <option value="">Select coach...</option>
              {(allUsers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 flex-1 sm:min-w-[200px]">
            <span className={LABEL}>Coachee</span>
            <select name="coacheeUserId" className={FIELD} required defaultValue="">
              <option value="">Select coachee...</option>
              {(allUsers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-[#1e293b] sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Add Assignment
          </button>
        </form>
      </div>

      {assignmentList.length === 0 ? (
        <EmptyState title="No coaching assignments yet" description="Create your first coach/coachee pair using the form above." />
      ) : (
        <>
          {/* Filters */}
          <div className={CARD}>
            <div className="border-b border-[#E5E7EB] px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex gap-3 sm:gap-4">
                <span className={ICON_WELL} aria-hidden>
                  <FunnelIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight text-[#111827]">Filters</h2>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">Search assignments by coach or coachee.</p>
                </div>
              </div>
            </div>
            <form method="get" className="flex flex-col gap-4 px-6 py-7 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-4 sm:px-8 sm:pb-8">
              <label className="min-w-0 flex-1 sm:min-w-[200px]">
                <span className={LABEL}>Coach</span>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    name="coach"
                    defaultValue={searchParams?.coach ?? ""}
                    placeholder="Filter by coach..."
                    className={`${FIELD} pl-10`}
                  />
                </div>
              </label>
              <label className="min-w-0 flex-1 sm:min-w-[200px]">
                <span className={LABEL}>Coachee</span>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    name="coachee"
                    defaultValue={searchParams?.coachee ?? ""}
                    placeholder="Filter by coachee..."
                    className={`${FIELD} pl-10`}
                  />
                </div>
              </label>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-5 py-2.5 text-sm font-semibold text-[#111827] shadow-sm calm-transition hover:bg-[#E5E7EB]/80 sm:flex-initial"
                >
                  <FunnelIcon className="h-4 w-4 shrink-0 text-[#6B7280]" />
                  Apply filters
                </button>
                {hasFilters ? (
                  <a
                    href="/admin/coaching"
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold text-[#6B7280] calm-transition hover:bg-[#F9FAFB] hover:text-[#111827] sm:flex-initial"
                  >
                    Clear
                  </a>
                ) : null}
              </div>
            </form>
          </div>

          {/* Assignments table */}
          <div className={CARD}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-transparent">
                    <th className="px-6 py-3.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280] sm:px-8">Coach</th>
                    <th className="w-[3rem] px-1 py-3.5 text-center sm:w-14" aria-hidden />
                    <th className="px-6 py-3.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280] sm:px-8">Coachee</th>
                    <th className="w-[1%] whitespace-nowrap px-6 py-3.5 text-right text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280] sm:px-8">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[0.8125rem] text-[#6B7280] sm:px-8">
                        No assignments match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a: any) => (
                      <tr key={`${a.coachUserId}-${a.coacheeUserId}`} className="border-b border-[#E5E7EB] last:border-b-0">
                        <td className="px-6 py-5 align-middle sm:px-8">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={a.coach?.fullName ?? "?"} size="md" />
                            <span className="truncate text-[0.8125rem] font-semibold text-[#111827]">{a.coach?.fullName}</span>
                          </div>
                        </td>
                        <td className="px-1 py-5 text-center align-middle text-[#9CA3AF]">
                          <span className="text-lg font-normal tabular-nums" aria-hidden>
                            →
                          </span>
                          <span className="sr-only">to</span>
                        </td>
                        <td className="px-6 py-5 align-middle sm:px-8">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={a.coachee?.fullName ?? "?"} size="md" />
                            <span className="truncate text-[0.8125rem] font-medium text-[#111827]">{a.coachee?.fullName}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 text-right align-middle sm:px-8">
                          <form action={removeAssignment} className="inline">
                            <input type="hidden" name="coachUserId" value={a.coachUserId} />
                            <input type="hidden" name="coacheeUserId" value={a.coacheeUserId} />
                            <button
                              type="submit"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] text-[#6B7280] calm-transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              title="Remove assignment"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" />
                              </svg>
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E5E7EB] px-6 py-3.5 sm:px-8">
              <p className="text-[0.8125rem] text-[#6B7280]">
                Showing{" "}
                <span className="font-semibold text-[#111827]">{filtered.length}</span>
                {filtered.length !== assignmentList.length ? (
                  <>
                    {" "}
                    of <span className="font-semibold text-[#111827]">{assignmentList.length}</span>
                  </>
                ) : null}{" "}
                assignment{assignmentList.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
