import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canViewObservation } from "@/modules/authz";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import {
  getAllSignalDefinitionsForTenantLabels,
  getSignalsForPhase,
} from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels } from "@/modules/observations/tenantSignalLabels";
import { formatPhaseLabel } from "@/modules/observations/phaseLabel";
import { formatYearGroup } from "@/modules/observations/yearGroup";
import type { SignalDefinition } from "@/modules/observations/signalTypes";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ClearDraftOnSuccess } from "../components/ClearDraftOnSuccess";
import { PrintExportButtons } from "../components/PrintExportButtons";
import { SignalMeter, shortScaleLabel } from "../components/SignalMeter";
import styles from "../components/flow.module.css";

/** Only follow `from` back into the observations area, never off-site. */
function safeBackHref(from: string | undefined): string {
  if (from && /^\/observe\/history(?:[?#]|$)/.test(from) && !from.startsWith("//")) return from;
  return "/observe/history";
}

const UK_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
};

export default async function ObservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string; saved?: string }>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  const [{ id }, sp] = await Promise.all([params, searchParams ?? Promise.resolve({} as { from?: string; saved?: string })]);
  const backHref = safeBackHref(sp.from);

  const observation = await (prisma as any).observation.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      observedTeacher: { select: { id: true, fullName: true } },
      observer: { select: { id: true, fullName: true } },
      signals: true,
    },
  });
  if (!observation) notFound();

  const [hodMemberships, coachAssignments, observedDeptMemberships] = await Promise.all([
    (prisma as any).departmentMembership.findMany({ where: { userId: user.id, isHeadOfDepartment: true } }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
    (prisma as any).departmentMembership.findMany({ where: { userId: observation.observedTeacherId } }),
  ]);

  const canView = canViewObservation(
    {
      userId: user.id,
      role: user.role,
      hodDepartmentIds: (hodMemberships as any[]).map((m: any) => m.departmentId),
      coacheeUserIds: (coachAssignments as any[]).map((a: any) => a.coacheeUserId),
    },
    {
      observedUserId: observation.observedTeacherId,
      observerUserId: observation.observerId,
      observedUserDepartmentIds: (observedDeptMemberships as any[]).map((m: any) => m.departmentId),
    },
  );
  // Same answer as a missing record, so the page doesn't confirm the observation exists.
  if (!canView) notFound();

  // How often a colleague has been observed is for leaders, their line managers and the person themselves,
  // not for a peer who happened to observe them.
  const observedDeptIds = new Set((observedDeptMemberships as any[]).map((m: any) => m.departmentId));
  const canSeeHistory =
    observation.observedTeacherId === user.id ||
    ["ADMIN", "SLT", "SUPER_ADMIN"].includes(user.role) ||
    (hodMemberships as any[]).some((m: any) => observedDeptIds.has(m.departmentId)) ||
    (coachAssignments as any[]).some((a: any) => a.coacheeUserId === observation.observedTeacherId);

  const [labelMap, schoolType, earlierCount] = await Promise.all([
    getTenantSignalLabels(user.tenantId),
    getTenantSchoolType(user.tenantId),
    (prisma as any).observation.count({
      where: {
        tenantId: user.tenantId,
        observedTeacherId: observation.observedTeacherId,
        observedAt: { lt: observation.observedAt },
      },
    }),
  ]);

  // Signals in the order they were asked, then anything recorded under an older definition.
  const recorded = new Map<string, { valueKey: string | null; notObserved: boolean }>(
    (observation.signals as any[]).map((s: any) => [s.signalKey, s]),
  );
  const phaseDefs = getSignalsForPhase(observation.phase, schoolType);
  const allDefs = new Map(getAllSignalDefinitionsForTenantLabels(schoolType).map((d) => [d.key as string, d]));
  const ordered: SignalDefinition[] = phaseDefs.filter((d) => recorded.has(d.key));
  for (const key of recorded.keys()) {
    if (!ordered.some((d) => d.key === key) && allDefs.has(key)) ordered.push(allDefs.get(key)!);
  }

  const name = (def: SignalDefinition) => (labelMap as any)[def.key]?.displayName || def.displayNameDefault;
  const strong = ordered.filter((d) => ["CONSISTENT", "STRONG"].includes(recorded.get(d.key)?.valueKey ?? ""));
  const develop = ordered.filter((d) => ["LIMITED", "SOME"].includes(recorded.get(d.key)?.valueKey ?? ""));
  const unseen = ordered.filter((d) => recorded.get(d.key)?.notObserved);

  const teacherName: string = observation.observedTeacher?.fullName ?? "Unknown member of staff";
  const observerName: string = observation.observer?.fullName ?? "Unknown";
  const dateLabel = new Date(observation.observedAt).toLocaleDateString("en-GB", UK_DATE);
  const isOwn = observation.observedTeacherId === user.id;
  const draftKey = `observation-draft:${user.tenantId}:${user.id}`;

  const facts: [string, string][] = [
    ["Class", observation.classCode || "—"],
    ["Year", formatYearGroup(observation.yearGroup)],
    ["Department", observation.subject || "—"],
    ["Part of lesson", observation.phase === "UNKNOWN" ? "Several or not sure" : formatPhaseLabel(observation.phase)],
    ["Observer", observation.observerId === user.id ? "You" : observerName],
    ...(canSeeHistory
      ? ([["Earlier observations", earlierCount === 0 ? "None, this was the first" : String(earlierCount)]] as [string, string][])
      : []),
  ];

  return (
    <div className={`${styles.page} mx-auto w-full max-w-5xl pb-16`}>
      {sp.saved === "1" ? <ClearDraftOnSuccess draftKey={draftKey} /> : null}

      <PageHeader
        title={isOwn ? "Your observation" : teacherName}
        subtitle={`${dateLabel}. Observed by ${observation.observerId === user.id ? "you" : observerName}.`}
        eyebrow={<Breadcrumb items={[{ label: "Observations", href: backHref }, { label: isOwn ? "Your observation" : teacherName }]} />}
        actions={<PrintExportButtons />}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {ordered.length ? (
            <section className={`${styles.card} grid grid-cols-3 overflow-hidden`} aria-label="Summary">
              {[
                ["Consistent or strong", strong.length],
                ["To develop", develop.length],
                ["Not seen", unseen.length],
              ].map(([label, n], i) => (
                <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${i ? "border-l border-[#e5e5e6]" : ""}`}>
                  <p className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums">{n}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-[#6e6e73]">{label}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className={styles.card} aria-labelledby="obs-signals">
            <h2 id="obs-signals" className="px-5 pb-3 pt-5 text-[15px] font-semibold">
              Signals
            </h2>
            {ordered.length ? (
              <div className={`${styles.rows} border-t border-[#f0f0f1]`}>
                {ordered.map((def) => {
                  const st = recorded.get(def.key)!;
                  const scale = st.valueKey ? def.scale.find((s) => s.key === st.valueKey) : null;
                  const guidance = st.valueKey ? def.scaleGuidance[st.valueKey as keyof typeof def.scaleGuidance] : null;
                  return (
                    <div key={def.key} className={`${styles.row} items-start`}>
                      <div className={styles.rowName}>
                        <p className="font-medium">{name(def)}</p>
                        {guidance ? <p className="mt-0.5 text-[13px] leading-relaxed text-[#6e6e73]">{guidance}</p> : null}
                      </div>
                      <span
                        className={`${styles.rowValue} flex items-center gap-2.5 pt-0.5`}
                        data-muted={!scale ? "" : undefined}
                      >
                        {scale ? (
                          <>
                            <SignalMeter valueKey={st.valueKey} />
                            <span className="truncate" title={scale.label}>{shortScaleLabel(st?.valueKey)}</span>
                          </>
                        ) : (
                          "Not seen"
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="border-t border-[#f0f0f1] px-5 py-6 text-[14px] text-[#6e6e73]">No signals were recorded.</p>
            )}
          </section>

          {observation.contextNote ? (
            <section className={`${styles.card} p-5`} aria-labelledby="obs-notes">
              <h2 id="obs-notes" className="text-[15px] font-semibold">
                Notes from {observerName.split(" ")[0]}
              </h2>
              <p className={`${styles.note} mt-3`}>{observation.contextNote}</p>
            </section>
          ) : null}
        </div>

        <aside className="order-first min-w-0 space-y-4 lg:order-none">
          <section className={styles.card} aria-label="Lesson details">
            <dl className={styles.facts}>
              {facts.map(([k, v]) => (
                <div key={k} className={styles.fact}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          {canSeeHistory && earlierCount > 0 && !isOwn ? (
            <Link
              href={`/observe/history?teacherId=${observation.observedTeacherId}#observation-records`}
              className="block px-1 text-[13px] font-medium text-[#3a3a3c] underline-offset-4 hover:text-[#1c1c1e] hover:underline print:hidden"
            >
              See all observations of {teacherName.split(" ")[0]}
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
