import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canViewObservation } from "@/modules/authz";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels } from "@/modules/observations/tenantSignalLabels";
import { ClearDraftOnSuccess } from "../components/ClearDraftOnSuccess";
import { PrintExportButtons } from "../components/PrintExportButtons";

/** Observation review badges: lavender (consistent) and coral (strong) per review UI spec */
const SCALE_DISPLAY: Record<string, { label: string; pillClass: string }> = {
  LIMITED: {
    label: "Limited",
    pillClass: "bg-scale-limited-bg text-scale-limited-text",
  },
  SOME: {
    label: "Some",
    pillClass: "bg-scale-some-bg text-scale-some-text",
  },
  CONSISTENT: {
    label: "Consistent",
    pillClass: "bg-[#ede9fe] text-[#5b21b6]",
  },
  STRONG: {
    label: "Strong",
    pillClass: "bg-[#ffe4e6] text-[#9f1239]",
  },
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SectionHeader({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-15 text-amber-800 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <h2 className="text-[0.9375rem] font-semibold tracking-tight text-text">{children}</h2>
    </div>
  );
}

export default async function ObservationDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");

  const observation = await (prisma as any).observation.findFirst({
    where: { id: params.id, tenantId: user.tenantId },
    include: { observedTeacher: true, observer: true, signals: true },
  });
  if (!observation) notFound();

  const priorObservationCount = await (prisma as any).observation.count({
    where: {
      tenantId: user.tenantId,
      observedTeacherId: observation.observedTeacherId,
      id: { not: observation.id },
    },
  });

  const [hodMemberships, coachAssignments, observedDeptMemberships] = await Promise.all([
    (prisma as any).departmentMembership.findMany({ where: { userId: user.id, isHeadOfDepartment: true } }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
    (prisma as any).departmentMembership.findMany({
      where: { userId: observation.observedTeacherId },
      include: { department: true },
    }),
  ]);

  const viewer = {
    userId: user.id,
    role: user.role,
    hodDepartmentIds: (hodMemberships as any[]).map((m: any) => m.departmentId),
    coacheeUserIds: (coachAssignments as any[]).map((a: any) => a.coacheeUserId),
  };

  const canView = canViewObservation(viewer, {
    observedUserId: observation.observedTeacherId,
    observerUserId: observation.observerId,
    observedUserDepartmentIds: (observedDeptMemberships as any[]).map((m: any) => m.departmentId),
  });
  if (!canView) throw new Error("FORBIDDEN");

  const labelMap = await getTenantSignalLabels(user.tenantId);
  const signalMap = new Map((observation.signals as any[]).map((s: any) => [s.signalKey, s]));
  const draftKey = `observation-draft:${user.tenantId}:${user.id}`;
  const schoolType = await getTenantSchoolType(user.tenantId);
  const observationSignalDefs = getSignalsForPhase(observation.phase, schoolType);

  const teacherDept = (observedDeptMemberships as any[])[0]?.department?.fullName ?? null;
  const teacherName: string = observation.observedTeacher?.fullName ?? "Unknown Teacher";
  const observerName: string = observation.observer?.fullName ?? "—";

  const observedAt = new Date(observation.observedAt);
  const dateLabel = observedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const dateTimeLabel =
    observedAt
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .toUpperCase() +
    " · " +
    observedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) +
    " GMT";

  const classLine = [
    observation.yearGroup ? `Year ${observation.yearGroup}` : null,
    observation.subject,
    observation.classCode ? `(${observation.classCode})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const roleLabel = formatRole(observation.observedTeacher?.role ?? "Teacher");
  const subtitleLine = teacherDept ? `${roleLabel} · ${teacherDept}` : roleLabel;

  const tenureLabel =
    priorObservationCount === 0
      ? "First observation on record"
      : `${priorObservationCount} prior observation${priorObservationCount === 1 ? "" : "s"}`;

  return (
    <div className="relative -mx-4 min-h-0 bg-background px-4 pb-14 pt-1 sm:-mx-6 sm:px-6">
      <ClearDraftOnSuccess draftKey={draftKey} />

      <div className="mx-auto max-w-6xl">
        <Link
          href="/observe/history"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text print:hidden"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
            <path
              d="M10 3.5 5.5 8l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Observation history
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-[1.625rem] font-bold leading-tight text-text">
              Observation Review — {dateLabel}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[0.875rem] leading-relaxed text-muted">
              Final summative report for this observation session
              {observation.subject ? ` · ${observation.subject}` : ""}
              {observation.yearGroup ? ` · Year ${observation.yearGroup}` : ""}
            </p>
          </div>
          <PrintExportButtons />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.86fr)_minmax(280px,1fr)]">
          {/* Main column */}
          <div className="min-w-0 space-y-10">
            <section>
              <SectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 3v18h18" strokeLinecap="round" />
                    <path d="M7 16l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                Signal Summary
              </SectionHeader>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {observationSignalDefs.map((signal) => {
                  const override = (labelMap as any)[signal.key];
                  const displayName = override?.displayName || signal.displayNameDefault;
                  const value = signalMap.get(signal.key);
                  const scaleKey = value?.valueKey as string | undefined;
                  const display = scaleKey ? SCALE_DISPLAY[scaleKey] : null;
                  const isSkipped = value?.notObserved && !value?.valueKey;

                  return (
                    <div
                      key={signal.key}
                      className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3.5"
                    >
                      <span className="min-w-0 truncate text-[0.8125rem] font-medium text-text">{displayName}</span>
                      <div className="shrink-0">
                        {display ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wide ${display.pillClass}`}
                          >
                            {display.label}
                          </span>
                        ) : isSkipped ? (
                          <span className="text-[0.75rem] text-muted">Skipped</span>
                        ) : (
                          <span className="text-[0.75rem] text-muted">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {observation.contextNote && (
              <section>
                <SectionHeader
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path
                        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                >
                  Concluding Reflections
                </SectionHeader>

                <div className="overflow-hidden rounded-2xl border border-border/30 bg-surface-container-lowest shadow-ambient">
                  <div className="border-l-4 border-tertiary-container px-6 py-6 sm:px-8 sm:py-7">
                    <blockquote className="text-[0.9375rem] font-medium leading-relaxed text-text italic">
                      &ldquo;{observation.contextNote}&rdquo;
                    </blockquote>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-border/20 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-[0.6875rem] font-bold text-on-primary"
                        aria-hidden
                      >
                        {initials(observerName)}
                      </div>
                      <div>
                        <p className="text-[0.8125rem] font-semibold text-text">{observerName}</p>
                        <p className="text-[0.75rem] text-muted">Observed &amp; Authenticated</p>
                      </div>
                    </div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{dateTimeLabel}</p>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-6">
            <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-ambient ring-1 ring-border/25">
              <div
                className="relative px-5 pb-8 pt-6 text-on-primary"
                style={{
                  backgroundColor: "var(--primary-container)",
                  backgroundImage:
                    "linear-gradient(135deg, rgba(255,255,255,0.07) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.07) 75%, transparent 75%, transparent)",
                  backgroundSize: "20px 20px",
                }}
              >
                <div className="relative flex flex-col items-center text-center">
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl bg-on-primary/15 text-lg font-bold text-on-primary ring-2 ring-on-primary/25">
                    {initials(teacherName)}
                  </div>
                  <h3 className="mt-4 text-[1.125rem] font-semibold leading-snug text-on-primary">
                    {teacherName}
                  </h3>
                  <p className="mt-1 text-[0.8125rem] text-on-primary/85">{subtitleLine}</p>
                </div>

                <ul className="relative mt-6 space-y-3 border-t border-on-primary/20 pt-5 text-left text-[0.8125rem] text-on-primary/90">
                  <li className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-on-primary/10">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </span>
                    <span className="pt-1 leading-snug">{roleLabel}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-on-primary/10">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                    </span>
                    <span className="pt-1 leading-snug">{tenureLabel}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-on-primary/10">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="8" r="6" />
                        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                      </svg>
                    </span>
                    <span className="pt-1 leading-snug">Teaching &amp; learning focus</span>
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-muted">Session Context</p>
              <div className="space-y-0 overflow-hidden rounded-2xl border border-border/25 bg-surface-container-lowest shadow-ambient">
                {[
                  {
                    label: "Class",
                    value: classLine || "—",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                    ),
                  },
                  {
                    label: "Duration",
                    value: "—",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    ),
                  },
                  {
                    label: "Observer",
                    value: observerName,
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ),
                  },
                  {
                    label: "Status",
                    value: "Completed",
                    accent: true,
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    ),
                  },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className={`flex items-start gap-3 px-4 py-4 ${i < arr.length - 1 ? "border-b border-border/20" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                      {row.icon}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted">{row.label}</p>
                      {row.accent ? (
                        <p className="mt-1 flex items-center gap-2 text-[0.875rem] font-bold uppercase tracking-wide text-[#9f1239]">
                          <span className="h-2 w-2 rounded-full bg-[#9f1239]" aria-hidden />
                          {row.value}
                        </p>
                      ) : (
                        <p className="mt-1 text-[0.875rem] font-semibold text-text">{row.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
