import { revalidateAdmin } from "@/lib/admin-sections";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";
import { CoachingAssignmentsView } from "@/components/admin/coaching-assignments-view";

const CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

const LABEL =
  "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]";

const ICON_WELL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5] [&_svg]:shrink-0";

const FIELD =
  "w-full min-h-[2.75rem] rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3.5 text-sm text-[var(--on-surface)] outline-none transition placeholder:text-[var(--on-surface-variant)] focus:border-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export async function CoachingAdminPanel() {
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
    revalidateAdmin("coaching");
  }

  async function removeAssignment(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const coachUserId = String(formData.get("coachUserId"));
    const coacheeUserId = String(formData.get("coacheeUserId"));
    await (prisma as any).coachAssignment.deleteMany({
      where: { tenantId: admin.tenantId, coachUserId, coacheeUserId },
    });
    revalidateAdmin("coaching");
  }

  const assignmentList = assignments as any[];
  const filterAssignments = assignmentList.map((a: any) => ({
    coachUserId: a.coachUserId as string,
    coacheeUserId: a.coacheeUserId as string,
    coachName: (a.coach?.fullName ?? "?") as string,
    coacheeName: (a.coachee?.fullName ?? "?") as string,
  }));

  return (
    <div className="space-y-6 pb-8">
      <AdminPageChrome
        area="Coaching"
        title="Coaching Assignments"
        subtitle="Manage coach-to-coachee pairs across your institution."
      />

      {/* New assignment */}
      <div className={CARD}>
        <div className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex gap-3 sm:gap-4">
            <span className={ICON_WELL} aria-hidden>
              <PlusIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-[var(--on-surface)]">New assignment</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">
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
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--on-surface)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-[var(--primary-container)] sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Add Assignment
          </button>
        </form>
      </div>

      {assignmentList.length === 0 ? (
        <EmptyState title="No coaching assignments yet" description="Create your first coach/coachee pair using the form above." />
      ) : (
        <CoachingAssignmentsView
          assignments={filterAssignments}
          totalCount={assignmentList.length}
          removeAssignment={removeAssignment}
        />
      )}
    </div>
  );
}

