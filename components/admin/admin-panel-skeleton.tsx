import type { AdminSectionId } from "@/lib/admin-sections";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--surface-container-high)] ${className}`} />;
}

function SkeletonHeader({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      <Pulse className="h-3 w-24" />
      <Pulse className="h-9 w-64 max-w-full rounded-lg" />
      {lines > 1 ? <Pulse className="h-4 w-full max-w-xl" /> : null}
    </div>
  );
}

function SkeletonMetricGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[142px] animate-pulse rounded-2xl bg-[var(--surface-container-low)]" />
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)]">
      <div className="flex gap-4 border-b border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] px-5 py-3.5">
        <Pulse className="h-3 w-20" />
        <Pulse className="h-3 w-24" />
        <Pulse className="h-3 w-16" />
        <Pulse className="ml-auto h-3 w-12" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] px-5 py-4 last:border-b-0"
        >
          <Pulse className="h-9 w-9 shrink-0 rounded-full" />
          <Pulse className="h-4 flex-1 max-w-[200px]" />
          <Pulse className="h-4 w-24" />
          <Pulse className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SkeletonFormCard({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4 rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] p-6">
      <Pulse className="h-5 w-40" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <Pulse className="h-10 w-32 rounded-xl" />
    </div>
  );
}

function SkeletonTabTiles({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] px-4 py-3.5"
        >
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[var(--surface-container-high)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-28 rounded bg-[var(--surface-container-high)]" />
            <div className="h-3 w-16 rounded bg-[var(--surface-container)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonUpload() {
  return (
    <div className="flex min-h-[200px] animate-pulse flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] bg-[var(--surface-container-low)]/50 px-6 py-12">
      <div className="h-12 w-12 rounded-full bg-[var(--surface-container-high)]" />
      <div className="h-4 w-48 max-w-full rounded bg-[var(--surface-container-high)]" />
      <div className="h-3 w-32 rounded bg-[var(--surface-container)]" />
    </div>
  );
}

const SECTION_LABELS: Partial<Record<AdminSectionId, string>> = {
  overview: "Admin Pulse",
  users: "Users",
  "users-import": "Staff import",
  departments: "Departments",
  coaching: "Coaching",
  "leave-approvals": "Leave approvals",
  settings: "School settings",
  language: "Language",
  signals: "Signals",
  "email-log": "Email log",
  taxonomies: "Taxonomies",
  timetable: "Timetable",
  imports: "Import jobs",
};

/** Placeholder while a lazy admin panel loads; layout hints match each section. */
export function AdminPanelSkeleton({ section = "overview" }: { section?: AdminSectionId }) {
  const label = SECTION_LABELS[section] ?? "Administration";

  const tableSections: AdminSectionId[] = [
    "users",
    "departments",
    "imports",
    "email-log",
    "timetable",
    "coaching",
    "leave-approvals",
  ];

  return (
    <div className="space-y-6" aria-busy="true" aria-label={`Loading ${label}`}>
      <SkeletonHeader lines={section === "overview" ? 2 : 1} />

      {section === "overview" ? (
        <>
          <SkeletonMetricGrid />
          <div className="h-24 animate-pulse rounded-sm bg-[var(--surface-container-low)]" />
        </>
      ) : null}

      {tableSections.includes(section) ? <SkeletonTable rows={section === "coaching" ? 4 : 6} /> : null}

      {section === "settings" || section === "language" || section === "signals" ? (
        <div className="space-y-4">
          <SkeletonFormCard fields={section === "settings" ? 4 : 3} />
          {section === "language" ? <SkeletonFormCard fields={2} /> : null}
        </div>
      ) : null}

      {section === "taxonomies" ? (
        <>
          <SkeletonTabTiles count={5} />
          <SkeletonTable rows={5} />
        </>
      ) : null}

      {section === "users-import" ? <SkeletonUpload /> : null}

      {!["overview", ...tableSections, "settings", "language", "signals", "taxonomies", "users-import"].includes(
        section,
      ) ? (
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-container-low)]" />
      ) : null}
    </div>
  );
}
