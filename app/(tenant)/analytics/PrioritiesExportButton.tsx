import { canExportExplorer } from "@/modules/authz";
import type { UserRole } from "@/lib/types";

const DOWNLOAD_ICON = (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function PrioritiesExportButton({
  userId,
  userRole,
  hodDepartmentIds,
  coacheeUserIds,
  activeTab,
  windowDays,
  departmentId,
}: {
  userId: string;
  userRole: UserRole;
  hodDepartmentIds: string[];
  coacheeUserIds: string[];
  activeTab: "teachers" | "cpd" | "students";
  windowDays: number;
  departmentId?: string;
}) {
  const canExport = canExportExplorer({ userId, role: userRole, hodDepartmentIds, coacheeUserIds });
  if (!canExport) return null;

  const view =
    activeTab === "teachers"
      ? "PRIORITIES_TEACHERS"
      : activeTab === "cpd"
        ? "PRIORITIES_CPD"
        : "PRIORITIES_STUDENTS";

  return (
    <form action="/api/explorer/export" method="POST">
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="windowDays" value={String(windowDays)} />
      {activeTab === "cpd" && departmentId ? <input type="hidden" name="departmentId" value={departmentId} /> : null}
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--on-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--surface-container-lowest)] shadow-[0_1px_2px_rgba(15,23,42,0.08)] calm-transition hover:opacity-90 motion-safe:hover:-translate-y-px active:scale-[0.98]"
      >
        {DOWNLOAD_ICON}
        Export CSV
      </button>
    </form>
  );
}
