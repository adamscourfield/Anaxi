import type { ReactNode } from "react";
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
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  OBS_REVIEW_MUTED,
  OBS_REVIEW_TEXT,
  ObservationReviewBackLink,
  ObservationReviewSectionHeader,
  ObservationReviewSessionCard,
  ObservationReviewSignalRow,
  ObservationReviewTeacherCard,
} from "../components/observationReviewUi";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ObservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  const resolvedParams = await params;

  const observation = await (prisma as any).observation.findFirst({
    where: { id: resolvedParams.id, tenantId: user.tenantId },
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

  const positiveSignals = observationSignalDefs.filter((signal) => {
    const scaleKey = (signalMap.get(signal.key) as any)?.valueKey as string | undefined;
    return scaleKey === "CONSISTENT" || scaleKey === "STRONG";
  });

  const focusSignals = observationSignalDefs.filter((signal) => {
    const scaleKey = (signalMap.get(signal.key) as any)?.valueKey as string | undefined;
    return scaleKey === "SOME" || scaleKey === "LIMITED";
  });

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

  const capIcon: ReactNode = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
  const calendarIcon: ReactNode = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
  const userIcon: ReactNode = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
  const bookIcon: ReactNode = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
  const clockIcon: ReactNode = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
  const checkIcon: ReactNode = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );

  const focusIcon = (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  return (
    <div className="relative -mx-4 min-h-0 bg-[var(--surface-container-low)] px-4 pb-14 pt-1 sm:-mx-6 sm:px-6">
      <ClearDraftOnSuccess draftKey={draftKey} />

      <div className="mx-auto max-w-6xl">
        <PageHeader
          variant="ledger"
          title={`${teacherName} — ${dateLabel}`}
          subtitle={`Observed by ${observerName}${observation.subject ? ` · ${observation.subject}` : ""}${observation.yearGroup ? ` · Year ${observation.yearGroup}` : ""}`}
          eyebrow={
            <Breadcrumb
              items={[
                { label: "Observations", href: "/observe/history" },
                { label: dateLabel },
              ]}
            />
          }
          actions={<PrintExportButtons />}
        />

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-12">
          <div className="min-w-0 space-y-10">
            <section>
              <ObservationReviewSectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 3v18h18" strokeLinecap="round" />
                    <path d="M7 16l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                title="Signal Summary"
              />

              <div className="space-y-2.5">
                {positiveSignals.map((signal) => {
                  const override = (labelMap as any)[signal.key];
                  const displayName = override?.displayName || signal.displayNameDefault;
                  return <ObservationReviewSignalRow key={signal.key}>{displayName}</ObservationReviewSignalRow>;
                })}
                {positiveSignals.length === 0 && (
                  <p className={`text-[0.875rem] italic ${OBS_REVIEW_MUTED}`}>
                    No signals rated consistent or strong in this session.
                  </p>
                )}
              </div>

              {focusSignals.length > 0 && (
                <div className="mt-8">
                  <h3 className={`mb-4 text-[0.9375rem] font-semibold ${OBS_REVIEW_TEXT}`}>What I need to focus on</h3>
                  <div className="space-y-2.5">
                    {focusSignals.map((signal) => {
                      const override = (labelMap as any)[signal.key];
                      const displayName = override?.displayName || signal.displayNameDefault;
                      return (
                        <ObservationReviewSignalRow key={signal.key} icon={focusIcon}>
                          {displayName}
                        </ObservationReviewSignalRow>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {observation.contextNote && (
              <section>
                <ObservationReviewSectionHeader
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path
                        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                  title="Concluding Reflections"
                />

                <div className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] shadow-sm">
                  <div className="border-l-4 border-amber-400 px-6 py-6 sm:px-8 sm:py-7">
                    <blockquote className={`text-[0.9375rem] font-medium leading-relaxed italic ${OBS_REVIEW_TEXT}`}>
                      &ldquo;{observation.contextNote}&rdquo;
                    </blockquote>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-[#F3F4F6] px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container)] text-[0.6875rem] font-bold ${OBS_REVIEW_TEXT}`}
                        aria-hidden
                      >
                        {initials(observerName)}
                      </div>
                      <div>
                        <p className={`text-[0.8125rem] font-semibold ${OBS_REVIEW_TEXT}`}>{observerName}</p>
                        <p className={`text-[0.75rem] ${OBS_REVIEW_MUTED}`}>Observed &amp; authenticated</p>
                      </div>
                    </div>
                    <p className={`text-[0.6875rem] font-semibold uppercase tracking-wider ${OBS_REVIEW_MUTED}`}>{dateTimeLabel}</p>
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-8">
            <ObservationReviewTeacherCard
              initials={initials(teacherName)}
              name={teacherName}
              roleUppercase="Teacher"
              rows={[
                { icon: capIcon, label: "Role", value: roleLabel },
                { icon: calendarIcon, label: "Prior observations", value: tenureLabel },
                { icon: userIcon, label: "Focus", value: "Teaching & learning focus" },
              ]}
            />

            <ObservationReviewSessionCard
              rows={[
                { label: "Class", value: classLine || "—", icon: bookIcon },
                { label: "Duration", value: "—", icon: clockIcon },
                { label: "Observer", value: observerName, icon: userIcon },
                {
                  label: "Status",
                  accent: true,
                  icon: checkIcon,
                  value: (
                    <span className="flex items-center gap-2 font-bold uppercase tracking-wide">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden />
                      Completed
                    </span>
                  ),
                },
              ]}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
