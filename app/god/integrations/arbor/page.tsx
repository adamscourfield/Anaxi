import Link from "next/link";
import { ReactNode } from "react";
import { requireSuperAdminUser } from "@/lib/admin";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { getCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { CsrfInput } from "@/components/CsrfInput";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { PageHeader } from "@/components/ui/page-header";
import { FormField } from "@/components/ui/form-field";
import { H3, MetaText } from "@/components/ui/typography";
import { mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import { arborConnectionHref } from "@/lib/integrations/arbor/connectionScope";

// This page embeds a request-specific, httpOnly-cookie-backed CSRF value.
export const dynamic = "force-dynamic";

type PreparedAssessmentDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; yearGroups?: string[] };
type ProposedAssessmentCycle = {
  key: string;
  label: string;
  academicYear: string;
  yearGroup: string;
  gradeFormat: string;
  definitions: string[];
};

function proposedAssessmentCycles(config: unknown): ProposedAssessmentCycle[] {
  const record = config && typeof config === "object" ? config as Record<string, unknown> : {};
  const excludedCycleKeys = new Set(
    Array.isArray(record.assessmentExcludedCycleKeys)
      ? record.assessmentExcludedCycleKeys.filter((key): key is string => typeof key === "string")
      : [],
  );
  const sync = record.assessmentSync && typeof record.assessmentSync === "object" ? record.assessmentSync as Record<string, unknown> : {};
  // Catalogue definitions are a discovery queue only. A cycle becomes
  // reviewable only after Arbor has supplied a dated mark for it.
  const definitions = Array.isArray(sync.historicalDefinitions)
    ? sync.historicalDefinitions.filter((item): item is PreparedAssessmentDefinition => Boolean(item) && typeof (item as PreparedAssessmentDefinition).id === "string" && typeof (item as PreparedAssessmentDefinition).label === "string")
    : [];
  const cycles = new Map<string, ProposedAssessmentCycle>();
  for (const definition of definitions) {
    const mapping = mapArborAssessment(definition.label, definition.assessmentDate, definition.periodHint);
    if (!mapping) continue;
    for (const yearGroup of definition.yearGroups?.length ? definition.yearGroups : mapping.yearGroups) {
      const cycle = mapArborAssessmentForYearGroup(mapping, yearGroup);
      if (!cycle || excludedCycleKeys.has(cycle.cycleExternalId)) continue;
      const existing = cycles.get(cycle.cycleExternalId);
      if (existing) {
        if (!existing.definitions.includes(definition.label)) existing.definitions.push(definition.label);
      } else {
        cycles.set(cycle.cycleExternalId, {
          key: cycle.cycleExternalId,
          label: cycle.cycleLabel,
          academicYear: cycle.academicYear,
          yearGroup,
          gradeFormat: cycle.gradeFormat === "PERCENTAGE" ? "Percentage" : cycle.gradeFormat === "A_LEVEL" ? "A-Level grades" : "GCSE grades",
          definitions: [definition.label],
        });
      }
    }
  }
  return [...cycles.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function assessmentReviewHref(cycleKey: string, connectionId: string): string {
  // Cycle keys include academic-year slashes. Encode the whole key so a reverse
  // proxy cannot split it into multiple URL path segments.
  return arborConnectionHref(`/god/integrations/arbor/assessments/${Buffer.from(cycleKey).toString("base64url")}`, connectionId);
}

// ─── Status banner ────────────────────────────────────────────────────────────
// Every Arbor action (connect, preview, sync...) redirects back here with query
// params describing its outcome. One shared banner keeps all of those consistent
// instead of each repeating its own ad-hoc card markup.

type BannerVariant = "success" | "danger";

const BANNER_STYLES: Record<BannerVariant, { border: string; bg: string; text: string }> = {
  success: { border: "border-success/30", bg: "bg-[var(--pill-success-bg)]", text: "text-success" },
  danger: { border: "border-error/30", bg: "bg-[var(--pill-error-bg)]", text: "text-error" },
};

function StatusBanner({
  variant,
  title,
  extra,
  children,
}: {
  variant: BannerVariant;
  title: string;
  /** A second line of detail, shown below the main message (e.g. a list of warnings). */
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const styles = BANNER_STYLES[variant];
  return (
    <Card className={`${styles.border} ${styles.bg}`}>
      <H3 className={styles.text}>{title}</H3>
      {children ? <MetaText className="mt-1">{children}</MetaText> : null}
      {extra ? <MetaText className="mt-1">{extra}</MetaText> : null}
    </Card>
  );
}

// ─── Section icons ────────────────────────────────────────────────────────────
// One icon + accent colour per data area, reused on the progress overview and
// each collapsible section header so both stay visually in sync.

function IconPlug({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22v-5M9 8V2M15 8V2M18 8H6a2 2 0 0 0-2 2v2a8 8 0 0 0 8 8v0a8 8 0 0 0 8-8v-2a2 2 0 0 0-2-2z" />
    </svg>
  );
}
function IconCamera({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconCalendarGrid({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );
}
function IconUsersSection({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconShieldSection({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconCalendarCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
    </svg>
  );
}
function IconMoon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function IconClipboardList({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

const SECTION_TILE_CLASS = {
  connection: "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]",
  photos: "bg-cat-blue-bg text-cat-blue-text",
  timetable: "bg-cat-indigo-bg text-cat-indigo-text",
  people: "bg-cat-violet-bg text-cat-violet-text",
  behaviour: "bg-scale-some-light text-scale-some-text",
  attendance: "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]",
  leave: "bg-cat-purple-bg text-cat-purple-text",
  assessments: "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning-text,var(--warning))]",
} as const;

const SECTION_ICON = {
  connection: <IconPlug />,
  photos: <IconCamera />,
  timetable: <IconCalendarGrid />,
  people: <IconUsersSection />,
  behaviour: <IconShieldSection />,
  attendance: <IconCalendarCheck />,
  leave: <IconMoon />,
  assessments: <IconClipboardList />,
} as const;

function ArborProgressRow({ label, detail, percent, tone = "neutral", icon, iconClassName }: { label: string; detail: string; percent: number; tone?: "success" | "warning" | "danger" | "neutral"; icon?: ReactNode; iconClassName?: string }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const barClass = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-error" : "bg-accent";
  return (
    <div className="space-y-2.5 rounded-sm border border-border/70 bg-[var(--surface-container-lowest)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:stroke-[1.75] ${iconClassName ?? "bg-[var(--surface-container)] text-muted"}`} aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold">{label}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-muted">{safePercent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-container-low)]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safePercent}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${barClass}`} style={{ width: `${safePercent}%` }} />
      </div>
      <MetaText>{detail}</MetaText>
    </div>
  );
}

// ─── Action menu ──────────────────────────────────────────────────────────────
// A primary action stays a visible button; less-frequent checks collapse into
// a "More" dropdown instead of stacking into a ragged row of equal-weight
// buttons. Native <details>/<summary> — no client JS needed, and each item is
// still a real <form> POST, so it works exactly like the buttons it replaces.

function ActionMenu({ label = "More", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="group/menu relative inline-block">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-border bg-[var(--surface-container-lowest)] px-4 py-2.5 text-sm font-semibold text-[var(--on-surface)] calm-transition hover:bg-[var(--surface-container-low)] [&::-webkit-details-marker]:hidden">
        {label}
        <svg className="h-3.5 w-3.5 text-muted calm-transition group-open/menu:rotate-180" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="absolute left-0 z-20 mt-1.5 w-72 space-y-0.5 rounded-md border border-border bg-[var(--surface-container-lowest)] p-1.5 shadow-lg">
        {children}
      </div>
    </details>
  );
}

/** A form-submitting action styled as a dropdown row instead of a standalone button. */
function MenuItemForm({ action, csrfToken, hidden, children }: { action: string; csrfToken: string; hidden?: Record<string, string>; children: ReactNode }) {
  return (
    <form method="post" action={action}>
      <CsrfInput token={csrfToken} />
      {hidden ? Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
      <button type="submit" className="w-full rounded px-3 py-2 text-left text-sm font-medium text-[var(--on-surface)] calm-transition hover:bg-[var(--surface-container-low)]">
        {children}
      </button>
    </form>
  );
}

 export default async function ArborIntegrationPage({ searchParams }: { searchParams?: Promise<{ connectionId?: string; new?: string; saved?: string; error?: string; csrf?: string; test?: string; photo?: string; photoSync?: string; studentPhotos?: string; staffPhotos?: string; unavailable?: string; failed?: string; attendance?: string; attendancePreview?: string; attendanceRecords?: string; attendanceStudents?: string; attendancePct?: string; attendanceLate?: string; attendanceUnmatched?: string; attendanceSync?: string; attendanceFrom?: string; attendanceTo?: string; attendanceCreated?: string; attendanceUpdated?: string; attendancePreserved?: string; behaviour?: string; behaviourPointAwards?: string; behaviourDetentions?: string; behaviourInternalExclusions?: string; behaviourSuspensions?: string; behaviourPreview?: string; behaviourStudents?: string; behaviourPoints?: string; behaviourUnmatched?: string; behaviourCapped?: string; assessment?: string; assessmentRecords?: string; assessmentPreview?: string; assessmentMarks?: string; assessmentLinked?: string; assessmentDefinitions?: string; assessmentPriorityDefinitions?: string; assessmentDefinition?: string; assessmentDefinitionFields?: string; assessmentValues?: string; assessmentValueFormat?: string; assessmentValueExamples?: string; assessmentGrades?: string; assessmentGradeFields?: string; assessmentPeriods?: string; assessmentPeriodFields?: string; assessmentSources?: string; assessmentSourcesAvailable?: string; assessmentSourcesBlocked?: string; assessmentSourceFields?: string; assessmentSourceFieldDetails?: string; assessmentCatalogue?: string; assessmentCatalogueTotal?: string; assessmentCataloguePriority?: string; assessmentCatalogueLabels?: string; assessmentActive?: string; assessmentActiveMarks?: string; assessmentActiveDefinitions?: string; assessmentActiveLabels?: string; assessmentActiveError?: string; assessmentApproval?: string; assessmentApproved?: string; assessmentImport?: string; assessmentImported?: string; assessmentImportSheets?: string; assessmentImportRemaining?: string; assessmentImportError?: string; assessmentHistory?: string; assessmentHistoryCycles?: string; assessmentHistoryBatches?: string; assessmentHistoryTargets?: string; assessmentHistoryAccepted?: string; assessmentHistoryReasons?: string; assessmentHistoryError?: string; assessmentFilters?: string; assessmentFilterNames?: string; timetable?: string; timetableFields?: string; timetablePreview?: string; timetableSync?: string; timetablePage?: string; timetableAssignments?: string; timetableLinkable?: string; timetableLinkedById?: string; timetableLinkedByName?: string; timetableMemberships?: string; timetableSubjects?: string; timetableTeachers?: string; timetableError?: string; leaveAccess?: string; leaveWriteOperations?: string; staffProvisioning?: string; staffProvisioningQueued?: string; preview?: string; total?: string; primary?: string; secondary?: string; offRoll?: string; review?: string; unrecognised?: string | string[]; comparison?: string; alreadyLinked?: string; possibleMatch?: string; ambiguousMatch?: string; newStudent?: string; skippedOffRoll?: string; needsReview?: string; sync?: string; created?: string; adopted?: string; archived?: string; historicStudents?: string; historicStudentCreated?: string; historicStudentArchived?: string; historicStudentSkipped?: string; historicStudentError?: string; staff?: string; activeInArbor?: string; linkedPrimaryOnly?: string; linkedSecondaryOnly?: string; linkedBoth?: string; possiblePrimaryOnly?: string; possibleSecondaryOnly?: string; possibleBoth?: string; unmatched?: string; ambiguous?: string; staffSync?: string; linked?: string; [key: string]: string | string[] | undefined }> }) {
  await requireSuperAdminUser();
  const [csrfToken, schools, integrations, params] = await Promise.all([
    getCsrfToken(),
    prisma.tenant.findMany({
      where: { id: { not: PLATFORM_TENANT_ID }, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, tenantSettings: { select: { schoolType: true } } },
    }),
    (prisma as any).sharedIntegration.findMany({
      where: { provider: "ARBOR" },
      include: { schools: { where: { enabled: true }, select: { tenantId: true, tenant: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    searchParams,
  ]);

  const integration = params?.new === "1"
    ? null
    : integrations.find((item: { id: string }) => item.id === params?.connectionId) ?? integrations[0] ?? null;
  const selected = new Set<string>(integration?.schools.map((school: { tenantId: string }) => school.tenantId) ?? []);
  const connectionAction = (path: string) => integration ? arborConnectionHref(path, integration.id) : path;
  const [recentSyncRuns, staffProvisioningRequests] = integration
    ? await Promise.all([
      (prisma as any).sharedIntegrationSyncRun.findMany({
        where: { integrationId: integration.id, entityType: { in: ["STUDENTS", "STAFF", "TIMETABLE", "BEHAVIOUR", "ATTENDANCE", "ASSESSMENTS"] } },
        orderBy: { startedAt: "desc" },
        take: 100,
        select: { entityType: true, status: true, recordsCreated: true, recordsUpdated: true, startedAt: true, finishedAt: true, errorSummary: true },
      }),
      (prisma as any).staffProvisioningRequest.findMany({ where: { integrationId: integration.id, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50 }),
    ])
    : [null, []];
  const latestRunByEntity = new Map<string, { entityType: string; status: string; recordsCreated: number; recordsUpdated: number; startedAt: Date; finishedAt: Date | null; errorSummary: string | null }>();
  for (const run of (recentSyncRuns ?? []) as Array<{ entityType: string; status: string; recordsCreated: number; recordsUpdated: number; startedAt: Date; finishedAt: Date | null; errorSummary: string | null }>) {
    if (!latestRunByEntity.has(run.entityType)) latestRunByEntity.set(run.entityType, run);
  }
  const latestBehaviourRun = latestRunByEntity.get("BEHAVIOUR") ?? null;
  const hostname = typeof integration?.config?.schoolHostname === "string" ? integration.config.schoolHostname : "";
  const assessmentCycles = proposedAssessmentCycles(integration?.config);
  const assessmentCyclesByYear = new Map<string, ProposedAssessmentCycle[]>();
  for (const cycle of assessmentCycles) {
    const current = assessmentCyclesByYear.get(cycle.academicYear) ?? [];
    current.push(cycle);
    assessmentCyclesByYear.set(cycle.academicYear, current);
  }
  const assessmentYears = [...assessmentCyclesByYear.keys()].sort((a, b) => b.localeCompare(a));
  const approvedAssessmentCycles = new Set<string>(
    Array.isArray(integration?.config?.assessmentApprovedCycleKeys)
      ? integration.config.assessmentApprovedCycleKeys.filter((key: unknown): key is string => typeof key === "string")
      : [],
  );
  const assessmentSync = integration?.config?.assessmentSync && typeof integration.config.assessmentSync === "object"
    ? integration.config.assessmentSync as {
      definitions?: PreparedAssessmentDefinition[];
      historicBatchDefinitionOffset?: number;
      historicComplete?: boolean;
      historicalDefinitions?: PreparedAssessmentDefinition[];
      importedMarks?: number;
      historicImportCursor?: number;
      historicImportedDefinitionIds?: string[];
      lastInspected?: { label?: unknown; reviewedMarks?: unknown; imported?: unknown; targets?: unknown; at?: unknown };
    }
    : {};
  const assessmentDiscoveryComplete = assessmentSync.historicComplete === true;
  const approvedAssessmentDefinitionCount = Array.isArray(assessmentSync.historicalDefinitions)
    ? new Set(assessmentSync.historicalDefinitions.filter((definition) => {
      const mapping = mapArborAssessment(definition.label, definition.assessmentDate, definition.periodHint);
      return Boolean(mapping && (definition.yearGroups?.length ? definition.yearGroups : mapping.yearGroups).some((yearGroup) => {
        const cycle = mapArborAssessmentForYearGroup(mapping, yearGroup);
        return cycle && approvedAssessmentCycles.has(cycle.cycleExternalId);
      }));
    }).map((definition) => definition.id)).size
    : 0;
  const importedAssessmentDefinitionCount = Array.isArray(assessmentSync.historicImportedDefinitionIds)
    ? assessmentSync.historicImportedDefinitionIds.length
    : 0;
  const assessmentImportRemaining = Math.max(0, approvedAssessmentDefinitionCount - importedAssessmentDefinitionCount);
  const preparedAssessmentDefinitions = Array.isArray(assessmentSync.definitions) ? assessmentSync.definitions.length : 0;
  const assessmentDefinitionsChecked = assessmentDiscoveryComplete
    ? preparedAssessmentDefinitions
    : Math.min(typeof assessmentSync.historicBatchDefinitionOffset === "number" ? assessmentSync.historicBatchDefinitionOffset : 0, preparedAssessmentDefinitions);
  const assessmentDiscoveryPercent = preparedAssessmentDefinitions ? (assessmentDefinitionsChecked / preparedAssessmentDefinitions) * 100 : 0;
  const assessmentImportProgress = assessmentSync.lastInspected
    && typeof assessmentSync.lastInspected === "object"
    && typeof assessmentSync.lastInspected.reviewedMarks === "number"
    ? assessmentSync.lastInspected
    : null;
  const secondaryTenantIds = schools
    .filter((school) => selected.has(school.id))
    .filter((school) => school.tenantSettings?.schoolType === "SECONDARY")
    .map((school) => school.id);
  const activeStudentsByYearGroup = secondaryTenantIds.length
    ? await prisma.student.groupBy({
      by: ["yearGroup"],
      where: { tenantId: { in: secondaryTenantIds }, status: "ACTIVE" },
      _count: { _all: true },
    })
    : [];
  const studentCountByYearGroup = new Map(activeStudentsByYearGroup.map((row) => [row.yearGroup, row._count._all]));
  const previewCount = (value: string | undefined) => (/^\d+$/.test(value ?? "") ? Number(value) : 0);
  // Buttons size to their own label instead of a fixed box, so a row of
  // several (e.g. the assessment section) reads as a tidy toolbar rather
  // than a ragged grid of equally-wide, mostly-empty pills.
  const actionButtonClass = "w-full sm:w-auto";
  const unrecognisedLevels = Array.isArray(params?.unrecognised)
    ? params.unrecognised
    : params?.unrecognised
      ? [params.unrecognised]
      : [];
  const behaviourNeedsAttention = latestBehaviourRun?.status === "FAILED" || latestBehaviourRun?.status === "PARTIAL";
  const assessmentNeedsReview = assessmentCycles.some((cycle) => !approvedAssessmentCycles.has(cycle.key));
  const assessmentNeedsAttention = assessmentNeedsReview || params?.assessmentHistory === "failed";
  const savedAttention = integration?.config?.attention && typeof integration.config.attention === "object"
    ? integration.config.attention as Record<string, unknown>
    : {};
  const savedLeaveAccess = integration?.config?.leaveAbsenceAccess && typeof integration.config.leaveAbsenceAccess === "object"
    ? integration.config.leaveAbsenceAccess as { status?: unknown }
    : null;
  const leaveNeedsAttention = params?.leaveAccess === "failed"
    || params?.leaveAccess === "not-connected"
    || savedLeaveAccess?.status === "NEEDS_ATTENTION"
    || Boolean(savedAttention.leave);
  const connectionNeedsAttention = params?.error === "secure-storage" || params?.test === "failed" || params?.test === "not-configured" || Boolean(savedAttention.connection);
  const photoNeedsAttention = params?.photo === "unavailable" || params?.photo === "not-connected" || params?.photo === "no-student" || Boolean(savedAttention.photos);
  const timetableNeedsAttention = params?.timetable === "failed" || params?.timetablePreview === "failed" || params?.timetableSync === "failed" || Boolean(params?.timetableError) || Boolean(savedAttention.timetable);
  const peopleNeedsAttention = params?.staff === "failed" || params?.staffSync === "failed" || params?.sync === "failed" || Boolean(savedAttention.people);
  const attendanceNeedsAttention = params?.attendance === "failed" || params?.attendancePreview === "failed" || params?.attendanceSync === "failed" || Boolean(savedAttention.attendance);
  const acknowledgedAttention = integration?.config?.acknowledgedAttention && typeof integration.config.acknowledgedAttention === "object"
    ? integration.config.acknowledgedAttention as Record<string, unknown>
    : {};
  const alertFingerprint = (section: string, issue: unknown) => issue ? `${section}:${typeof issue === "string" ? issue : JSON.stringify(issue)}` : null;
  const connectionAlert = alertFingerprint("connection", params?.error ?? params?.test ?? savedAttention.connection);
  const photoAlert = alertFingerprint("photos", params?.photo ?? savedAttention.photos);
  const timetableAlert = alertFingerprint("timetable", params?.timetableError ?? params?.timetableSync ?? params?.timetablePreview ?? params?.timetable ?? savedAttention.timetable);
  const peopleAlert = alertFingerprint("people", params?.staffSync ?? params?.staff ?? params?.sync ?? savedAttention.people);
  const behaviourAlert = alertFingerprint("behaviour", behaviourNeedsAttention ? `${latestBehaviourRun?.status}:${latestBehaviourRun?.startedAt?.toISOString() ?? ""}` : savedAttention.behaviour);
  const attendanceAlert = alertFingerprint("attendance", params?.attendanceSync ?? params?.attendancePreview ?? params?.attendance ?? savedAttention.attendance);
  const leaveAlert = alertFingerprint(
    "leave",
    params?.leaveAccess ?? (savedLeaveAccess?.status === "NEEDS_ATTENTION" ? savedAttention.leave ?? savedLeaveAccess.status : null),
  );
  const assessmentAlert = alertFingerprint("assessments", assessmentNeedsReview ? assessmentCycles.filter((cycle) => !approvedAssessmentCycles.has(cycle.key)).map((cycle) => cycle.key).sort() : params?.assessmentHistory === "failed" ? "history-failed" : savedAttention.assessments);
  const visibleAlert = (section: string, fingerprint: string | null) => Boolean(fingerprint && acknowledgedAttention[section] !== fingerprint);

  // One list drives both the per-section "!" badge/banner and the page-level
  // "Needs attention" summary below, so an administrator never has to hunt
  // through 8 collapsed sections to find out what is actually wrong.
  const attentionFingerprintByKey: Record<keyof typeof SECTION_ICON, string | null> = {
    connection: connectionAlert, photos: photoAlert, timetable: timetableAlert, people: peopleAlert,
    behaviour: behaviourAlert, attendance: attendanceAlert, leave: leaveAlert, assessments: assessmentAlert,
  };
  const attentionItems = (
    [
      { key: "connection", label: "Connection", message: "The Arbor connection needs review. Check the connection result below before acknowledging it." },
      { key: "photos", label: "Photo access", message: "Arbor photo access needs review. Check the photo result below before acknowledging it." },
      { key: "timetable", label: "Timetable access", message: "The timetable sync needs review. Check the latest result below before acknowledging it." },
      { key: "people", label: "Staff and student syncing", message: "The people sync needs review. Check the latest result below before acknowledging it." },
      { key: "behaviour", label: "Behaviour syncing", message: "The latest behaviour sync needs review. Check the error below before acknowledging it." },
      { key: "attendance", label: "Attendance syncing", message: "The attendance sync needs review. Check the latest result below before acknowledging it." },
      { key: "leave", label: "Leave of absence syncing", message: "Arbor staff-absence access needs review. Check the permission result below before acknowledging it." },
      { key: "assessments", label: "Assessment syncing", message: "Assessment review needs attention. Check the cycle status below before acknowledging it." },
    ] as Array<{ key: keyof typeof SECTION_ICON; label: string; message: string }>
  ).filter((item) => visibleAlert(item.key, attentionFingerprintByKey[item.key]));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        variant="ledger"
        eyebrow="God Mode"
        title="Arbor connection"
        subtitle="Select a real school’s Arbor connection before reviewing or syncing its data."
        actions={<Link href="/god"><Button variant="secondary" className="w-full sm:w-64">Back to schools</Button></Link>}
      />

      <Card className="space-y-4" tone="inset">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Arbor connections</div>
            <H3 className="mt-1">Choose a school connection</H3>
          </div>
          <MetaText>Each connection has separate credentials, sync state, alerts, and approvals.</MetaText>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {integrations.map((item: { id: string; label: string; status: string; schools: Array<{ tenant: { name: string } }> }) => {
            const active = item.id === integration?.id;
            return <Link key={item.id} href={arborConnectionHref("/god/integrations/arbor", item.id)} className={`rounded-sm border p-4 calm-transition ${active ? "border-accent bg-[var(--surface-container-lowest)] ring-1 ring-accent/30" : "border-border/70 bg-[var(--surface-container-lowest)] hover:border-accent/60"}`}>
              <div className="flex items-center justify-between gap-3"><span className="font-semibold">{item.label}</span><span className={item.status === "CONNECTED" ? "text-xs font-semibold text-success" : "text-xs font-semibold text-muted"}>{item.status.toLowerCase()}</span></div>
              <MetaText className="mt-1">{item.schools.map((school) => school.tenant.name).join(" · ") || "No Anaxi schools linked"}</MetaText>
            </Link>;
          })}
          <Link href="/god/integrations/arbor?new=1" className="rounded-sm border border-dashed border-border px-4 py-4 text-sm font-semibold text-accent hover:border-accent">+ Add another Arbor connection</Link>
        </div>
      </Card>

      {params?.saved === "1" ? (
        <StatusBanner variant="success" title="Arbor connection saved.">
          Its login details are encrypted. The connection will remain inactive until the first sync is built and verified.
        </StatusBanner>
      ) : null}

      {params?.error === "secure-storage" ? (
        <StatusBanner variant="danger" title="Arbor details were not saved.">
          Secure credential storage has not been configured for this Anaxi environment. Add the integration encryption key in the hosting environment, then try again.
        </StatusBanner>
      ) : null}

      {params?.csrf === "expired" ? (
        <StatusBanner variant="danger" title="Your page was refreshed for security.">
          Please run the assessment check again. No Arbor data was read or changed.
        </StatusBanner>
      ) : null}

      {params?.test === "success" ? (
        <StatusBanner variant="success" title="Arbor connection verified.">
          Anaxi can securely read Arbor. No school data has been imported yet.
        </StatusBanner>
      ) : null}

      {params?.test === "failed" || params?.test === "not-configured" ? (
        <StatusBanner variant="danger" title="Arbor connection needs attention.">
          {params?.test === "not-configured" ? "Save the Arbor application credentials before checking the connection." : integration?.lastSyncError ?? "Try saving the Arbor application credentials again."}
        </StatusBanner>
      ) : null}

      {integration?.status === "CONNECTED" ? (
        <Card className="space-y-4" tone="inset">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Connection progress</div><H3 className="mt-1">Arbor connection and import status</H3></div>
            <MetaText>Each connection is tracked independently.</MetaText>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ArborProgressRow label="Connection" percent={100} tone="success" detail="Credentials verified and connection is active." icon={SECTION_ICON.connection} iconClassName={SECTION_TILE_CLASS.connection} />
            <ArborProgressRow label="Students and staff" percent={latestRunByEntity.has("STUDENTS") && latestRunByEntity.has("STAFF") ? 100 : 0} tone={latestRunByEntity.get("STUDENTS")?.status === "FAILED" || latestRunByEntity.get("STAFF")?.status === "FAILED" ? "danger" : latestRunByEntity.has("STUDENTS") && latestRunByEntity.has("STAFF") ? "success" : "neutral"} detail={latestRunByEntity.has("STUDENTS") && latestRunByEntity.has("STAFF") ? "Latest people syncs have completed." : "Awaiting first completed people sync."} icon={SECTION_ICON.people} iconClassName={SECTION_TILE_CLASS.people} />
            <ArborProgressRow label="Timetable" percent={latestRunByEntity.get("TIMETABLE")?.status === "SUCCESS" ? 100 : 0} tone={latestRunByEntity.get("TIMETABLE")?.status === "FAILED" ? "danger" : latestRunByEntity.get("TIMETABLE")?.status === "SUCCESS" ? "success" : "neutral"} detail={latestRunByEntity.get("TIMETABLE")?.status === "SUCCESS" ? "Latest timetable page completed." : "Subject-teacher mapping is still awaiting confirmation."} icon={SECTION_ICON.timetable} iconClassName={SECTION_TILE_CLASS.timetable} />
            <ArborProgressRow label="Behaviour" percent={latestRunByEntity.get("BEHAVIOUR")?.status === "SUCCESS" ? 100 : 0} tone={latestRunByEntity.get("BEHAVIOUR")?.status === "FAILED" ? "danger" : latestRunByEntity.get("BEHAVIOUR")?.status === "SUCCESS" ? "success" : "neutral"} detail={latestRunByEntity.get("BEHAVIOUR")?.status === "SUCCESS" ? "Nightly behaviour sync is active." : "Awaiting a completed behaviour sync."} icon={SECTION_ICON.behaviour} iconClassName={SECTION_TILE_CLASS.behaviour} />
            <ArborProgressRow label="Attendance" percent={latestRunByEntity.get("ATTENDANCE")?.status === "SUCCESS" ? 100 : 0} tone={latestRunByEntity.get("ATTENDANCE")?.status === "FAILED" ? "danger" : latestRunByEntity.get("ATTENDANCE")?.status === "SUCCESS" ? "success" : "neutral"} detail={latestRunByEntity.get("ATTENDANCE")?.status === "SUCCESS" ? "Nightly attendance sync is active." : "Awaiting a completed attendance sync."} icon={SECTION_ICON.attendance} iconClassName={SECTION_TILE_CLASS.attendance} />
            <ArborProgressRow label="Assessment discovery" percent={assessmentDiscoveryPercent} tone={assessmentNeedsAttention ? "warning" : assessmentDiscoveryComplete ? "success" : "neutral"} detail={preparedAssessmentDefinitions ? assessmentDiscoveryComplete ? `${preparedAssessmentDefinitions} prepared definitions checked; ready for review.` : `${assessmentDefinitionsChecked} of ${preparedAssessmentDefinitions} prepared definitions checked automatically.` : "Awaiting the assessment catalogue."} icon={SECTION_ICON.assessments} iconClassName={SECTION_TILE_CLASS.assessments} />
          </div>
        </Card>
      ) : null}

      {params?.photo === "success" ? (
        <StatusBanner variant="success" title="Arbor photo access verified.">
          Anaxi can request a photo from Arbor. No image has been imported or stored yet.
        </StatusBanner>
      ) : null}

      {params?.photo === "unavailable" || params?.photo === "not-connected" || params?.photo === "no-student" ? (
        <StatusBanner variant="danger" title="Arbor photo access is not available yet.">
          No image was imported. Check that Arbor has enabled photo API access for the Anaxi app.
        </StatusBanner>
      ) : null}

      {params?.photoSync === "success" ? (
        <StatusBanner variant="success" title="Arbor photo sync batch complete.">
          {previewCount(params.studentPhotos)} student and {previewCount(params.staffPhotos)} staff photos were copied; {previewCount(params.unavailable)} people had no available Arbor photo, and {previewCount(params.failed)} could not be downloaded. The nightly sync continues in small batches.
        </StatusBanner>
      ) : null}

      {params?.attendance === "success" ? (
        <StatusBanner variant="success" title="Arbor attendance access verified.">
          Anaxi read {previewCount(params.attendanceRecords)} attendance record without importing anything. The next step is a read-only attendance summary preview.
        </StatusBanner>
      ) : null}

      {params?.attendance === "failed" || params?.attendance === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor attendance access needs attention.">
          No attendance data was imported.
        </StatusBanner>
      ) : null}

      {params?.attendancePreview === "success" ? (
        <StatusBanner variant="success" title="Attendance summary preview complete.">
          From the latest seven days, {previewCount(params.attendanceRecords)} records covered {previewCount(params.attendanceStudents)} linked students: {params?.attendancePct ?? "0"}% attendance and {previewCount(params.attendanceLate)} late marks. {previewCount(params.attendanceUnmatched)} records could not be linked. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.attendancePreview === "failed" || params?.attendancePreview === "not-connected" ? (
        <StatusBanner variant="danger" title="Attendance summary preview could not run.">
          No attendance data was imported. Anaxi will use the confirmed Arbor response details to adjust the read-only query safely.
        </StatusBanner>
      ) : null}

      {params?.attendanceSync === "success" ? (
        <StatusBanner variant="success" title="Attendance sync batch complete.">
          Anaxi updated its academic-year attendance totals for {params.attendanceFrom} to {params.attendanceTo}: {previewCount(params.attendanceCreated)} new daily snapshots and {previewCount(params.attendanceUpdated)} refreshed snapshots. {previewCount(params.attendancePreserved)} manual snapshots were left unchanged. The nightly sync will continue until it is caught up, then update the latest completed day.
        </StatusBanner>
      ) : null}

      {params?.attendanceSync === "up-to-date" ? (
        <StatusBanner variant="success" title="Attendance is up to date.">
          Anaxi already holds the latest completed academic-year attendance day from Arbor.
        </StatusBanner>
      ) : null}

      {params?.attendanceSync === "failed" || params?.attendanceSync === "not-connected" || params?.attendanceSync === "confirmation-required" ? (
        <StatusBanner variant="danger" title="Attendance sync did not run.">
          {params.attendanceSync === "confirmation-required" ? "Confirm the attendance sync before Anaxi changes its attendance measures." : params.attendanceSync === "not-connected" ? "Check the Arbor connection before starting attendance sync." : "No further attendance changes were made after the issue was detected. Check the God Mode audit log."}
        </StatusBanner>
      ) : null}

      {params?.behaviour === "success" ? (
        <StatusBanner variant="success" title="Arbor behaviour access verified.">
          Anaxi read one record from each behaviour source without importing anything: {previewCount(params.behaviourPointAwards)} positive-point awards, {previewCount(params.behaviourDetentions)} detentions, {previewCount(params.behaviourInternalExclusions)} internal exclusions, and {previewCount(params.behaviourSuspensions)} suspensions were available in the test.
        </StatusBanner>
      ) : null}

      {params?.behaviour === "failed" || params?.behaviour === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor behaviour access needs attention.">
          No behaviour data was imported. Anaxi will adjust the read-only check from Arbor&rsquo;s confirmed response before enabling a sync.
        </StatusBanner>
      ) : null}

      {params?.behaviourPreview === "success" ? (
        <StatusBanner variant="success" title="Behaviour summary preview complete.">
          From the latest seven days, {previewCount(params.behaviourStudents)} linked students had {previewCount(params.behaviourPoints)} positive points, {previewCount(params.behaviourDetentions)} detentions, {previewCount(params.behaviourInternalExclusions)} internal exclusions, and {previewCount(params.behaviourSuspensions)} suspensions. {previewCount(params.behaviourUnmatched)} records could not be linked. {params.behaviourCapped === "1" ? "This is the first 100 records from one or more sources, so it is a safe sample rather than a full period total." : "Nothing has been imported."}
        </StatusBanner>
      ) : null}

      {params?.behaviourPreview === "failed" || params?.behaviourPreview === "not-connected" || params?.behaviourPreview === "range-mismatch" ? (
        <StatusBanner variant="danger" title="Behaviour summary preview could not run.">
          {params.behaviourPreview === "range-mismatch" ? "Arbor returned behaviour records outside the requested seven-day period. No data was imported; Anaxi will not enable the sync until the date filter is corrected." : "No behaviour data was imported. Anaxi will use the confirmed Arbor response details to adjust the read-only query safely."}
        </StatusBanner>
      ) : null}

      {params?.assessment === "success" ? (
        <StatusBanner variant="success" title="Arbor priority-assessment access verified.">
          Anaxi read {previewCount(params.assessmentRecords)} progress assessment mark without importing anything. The next step is a read-only mapping preview.
        </StatusBanner>
      ) : null}

      {params?.assessment === "failed" || params?.assessment === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor assessment access needs attention.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentPreview === "success" ? (
        <StatusBanner variant="success" title="Assessment mapping preview complete.">
          {previewCount(params.assessmentMarks)} Arbor marks were sampled: {previewCount(params.assessmentLinked)} link to Anaxi students across {previewCount(params.assessmentDefinitions)} assessment definitions, including {previewCount(params.assessmentPriorityDefinitions)} matching P8, A-Level, KS1, or KS2. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentPreview === "failed" || params?.assessmentPreview === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment mapping preview could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentDefinition === "success" ? (
        <StatusBanner variant="success" title="Assessment definition checked.">
          Arbor confirms these mapping details are available: {params.assessmentDefinitionFields || "none of the required fields"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentDefinition === "failed" || params?.assessmentDefinition === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment definition check could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentValues === "success" ? (
        <StatusBanner variant="success" title="Assessment values previewed.">
          The sample looks like {params.assessmentValueFormat ?? "needs review"}. Example values: {params.assessmentValueExamples || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentValues === "failed" || params?.assessmentValues === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment values preview could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentGrades === "success" ? (
        <StatusBanner variant="success" title="Assessment grade fields checked.">
          Arbor confirms these grade label fields are available: {params.assessmentGradeFields || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentGrades === "failed" || params?.assessmentGrades === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment grade check could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentPeriods === "success" ? (
        <StatusBanner variant="success" title="Assessment period fields checked.">
          Arbor exposes these possible period fields on progress marks: {params.assessmentPeriodFields || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentPeriods === "failed" || params?.assessmentPeriods === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment period check could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentSources === "success" ? (
        <StatusBanner variant="success" title="Historic assessment sources checked.">
          Available: {params.assessmentSourcesAvailable || "none"}. Blocked or unavailable: {params.assessmentSourcesBlocked || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentSources === "failed" || params?.assessmentSources === "not-connected" ? (
        <StatusBanner variant="danger" title="Historic assessment sources could not be checked.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentSourceFields === "success" ? (
        <StatusBanner variant="success" title="Historic assessment source fields checked.">
          {params.assessmentSourceFieldDetails || "No fields were returned."} Nothing has been imported.
        </StatusBanner>
      ) : null}
      {params?.assessmentSourceFields === "failed" || params?.assessmentSourceFields === "not-connected" ? (
        <StatusBanner variant="danger" title="Historic assessment source fields could not be checked.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentCatalogue === "success" ? (
        <StatusBanner variant="success" title="Priority assessment catalogue preview complete.">
          Arbor has {previewCount(params.assessmentCatalogueTotal)} assessment definitions, with {previewCount(params.assessmentCataloguePriority)} matching P8, A-Level, KS1, or KS2. {params.assessmentCatalogueLabels ? `Matches: ${params.assessmentCatalogueLabels}.` : ""} Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentCatalogue === "failed" || params?.assessmentCatalogue === "not-connected" ? (
        <StatusBanner variant="danger" title="Priority assessment catalogue preview could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentActive === "prepared" ? (
        <StatusBanner variant="success" title="Assessment sync prepared.">
          {previewCount(params.assessmentActiveDefinitions)} agreed assessment definitions are ready for review. No results will import until individual cycles have been approved below.
        </StatusBanner>
      ) : null}

      {params?.assessmentApproval === "success" ? (
        <StatusBanner variant="success" title="Assessment cycles approved.">
          {previewCount(params.assessmentApproved)} cycle(s) are ready. Use “Import approved results now” below to start immediately; the overnight sync remains a fallback.
        </StatusBanner>
      ) : null}

      {params?.assessmentImport === "success" ? (
        <StatusBanner variant="success" title="Approved assessment results imported.">
          {previewCount(params.assessmentImported)} verified mark{previewCount(params.assessmentImported) === 1 ? "" : "s"} from {previewCount(params.assessmentImportSheets)} reviewed subject sheet{previewCount(params.assessmentImportSheets) === 1 ? "" : "s"} were written to Attainment. {previewCount(params.assessmentImportRemaining)} approved sheet{previewCount(params.assessmentImportRemaining) === 1 ? "" : "s"} remain.
        </StatusBanner>
      ) : null}
      {params?.assessmentImport === "complete" ? (
        <StatusBanner variant="success" title="Approved assessment import complete.">
          Every currently approved review sheet has been written to Attainment.
        </StatusBanner>
      ) : null}
      {params?.assessmentImport === "unavailable" ? (
        <StatusBanner variant="danger" title="Approved assessment import could not start.">
          No reviewed subject sheets matched the approved cycles. Refresh the review and save the approved cycles again.
        </StatusBanner>
      ) : null}
      {params?.assessmentImport === "not-connected" || params?.assessmentImport === "failed" ? (
        <StatusBanner variant="danger" title="Approved assessment import could not complete.">
          Nothing was changed. {params?.assessmentImportError || integration?.lastSyncError || "Check the Arbor connection status and try the safe import again."}
        </StatusBanner>
      ) : null}

      {params?.assessmentApproval === "paused" ? (
        <StatusBanner variant="success" title="Assessment imports paused.">
          No new Arbor assessment results will be imported until cycles are approved again.
        </StatusBanner>
      ) : null}
      {params?.assessmentApproval === "deleted" ? (
        <StatusBanner variant="success" title="Assessment cycle removed from review.">
          It is no longer approved and will not import into Attainment. Existing Attainment results were not deleted.
        </StatusBanner>
      ) : null}
      {params?.assessmentApproval === "discovery-in-progress" ? (
        <StatusBanner variant="danger" title="Assessment approval is not ready yet.">
          Historic discovery must finish before cycles can be approved, so each approved cycle includes every matching Arbor subject.
        </StatusBanner>
      ) : null}

      {params?.assessmentActive === "failed" || params?.assessmentActive === "not-connected" ? (
        <StatusBanner variant="danger" title="Active priority assessment preview could not run.">
          {params.assessmentActiveError || "No assessment data was imported."}
        </StatusBanner>
      ) : null}

      {params?.assessmentFilters === "success" ? (
        <StatusBanner variant="success" title="Assessment filters checked.">
          Arbor supports these progress-mark filters: {params.assessmentFilterNames || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentFilters === "failed" || params?.assessmentFilters === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment filter check could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.timetable === "success" ? (
        <StatusBanner variant="success" title="Arbor timetable mapping is available.">
          Anaxi has confirmed the timetable relationships it needs. The next step is to map these safely to each student&apos;s existing subject-teacher links.
        </StatusBanner>
      ) : null}

      {params?.timetable === "failed" || params?.timetable === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor timetable mapping needs attention.">
          No student-teacher links were changed.
        </StatusBanner>
      ) : null}

      {params?.timetablePreview === "success" ? (
        <StatusBanner variant="success" title="Subject-teacher preview complete.">
          Arbor returned {previewCount(params.timetableAssignments)} timetable assignments, of which {previewCount(params.timetableLinkable)} can be linked to existing Anaxi students and staff. Matching uses Arbor IDs first and a unique exact name only when an Arbor ID is not yet stored. Nothing has been changed.
        </StatusBanner>
      ) : null}

      {params?.timetablePreview === "failed" || params?.timetablePreview === "not-connected" ? (
        <StatusBanner variant="danger" title="Subject-teacher preview could not run.">
          {params.timetableError || "No student-teacher links were changed."}
        </StatusBanner>
      ) : null}

      {params?.timetableSync === "success" ? (
        <StatusBanner variant="success" title="Subject teachers synced.">
          {previewCount(params.timetableLinkable)} current Arbor subject-teacher links are now shown on student records: {previewCount(params.timetableLinkedById)} matched by Arbor ID and {previewCount(params.timetableLinkedByName)} using a unique exact name. Manually entered Anaxi links were kept unchanged.
        </StatusBanner>
      ) : null}

      {params?.timetableSync === "progress" ? (
        <StatusBanner variant="success" title="Subject-teacher sync is continuing.">
          Roster page {previewCount(params.timetablePage)} read {previewCount(params.timetableMemberships)} student class memberships across {previewCount(params.timetableSubjects)} subject classes and {previewCount(params.timetableTeachers)} teacher-led classes. {previewCount(params.timetableLinkable)} subject-teacher links were confirmed: {previewCount(params.timetableLinkedById)} by Arbor ID and {previewCount(params.timetableLinkedByName)} by a unique exact name. The remaining pages will continue automatically overnight, or you can run the next page now.
        </StatusBanner>
      ) : null}

      {params?.timetableSync === "failed" || params?.timetableSync === "not-connected" || params?.timetableSync === "confirmation-required" ? (
        <StatusBanner variant="danger" title="Subject-teacher sync could not run.">
          {params.timetableError || "No existing subject-teacher links were changed."}
        </StatusBanner>
      ) : null}

      {params?.preview === "success" ? (
        <StatusBanner
          variant="success"
          title="Student preview complete."
          extra={unrecognisedLevels.length > 0 ? <>Unrecognised levels: {unrecognisedLevels.join("; ")}.</> : null}
        >
          {previewCount(params.total)} students found: {previewCount(params.primary)} for Primary, {previewCount(params.secondary)} for Secondary, {previewCount(params.offRoll)} off-roll records skipped, and {previewCount(params.review)} needing review. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.preview === "failed" || params?.preview === "not-connected" ? (
        <StatusBanner variant="danger" title="Student preview could not run.">
          {params?.preview === "not-connected" ? "Check the Arbor connection before previewing students." : "Anaxi could not read the student fields needed for the preview. No data was imported."}
        </StatusBanner>
      ) : null}

      {params?.comparison === "success" ? (
        <StatusBanner variant="success" title="Student comparison complete.">
          {previewCount(params.alreadyLinked)} already linked to Arbor, {previewCount(params.possibleMatch)} possible existing Anaxi matches, {previewCount(params.ambiguousMatch)} ambiguous matches, and {previewCount(params.newStudent)} potentially new students. Nothing has been changed.
        </StatusBanner>
      ) : null}

      {params?.comparison === "failed" || params?.comparison === "not-connected" ? (
        <StatusBanner variant="danger" title="Student comparison could not run.">
          {params?.comparison === "not-connected" ? "Check the Arbor connection before comparing students." : "Anaxi could not compare Arbor students with the existing Anaxi records. No data was changed."}
        </StatusBanner>
      ) : null}

      {params?.sync === "success" ? (
        <StatusBanner variant="success" title="Student sync complete.">
          {previewCount(params.created)} new students were added and {previewCount(params.adopted)} existing Anaxi students were linked to Arbor. Future syncs can update these records safely.
        </StatusBanner>
      ) : null}

      {params?.sync === "failed" || params?.sync === "not-connected" || params?.sync === "confirmation-required" || params?.sync === "migration-required" ? (
        <StatusBanner variant="danger" title="Student sync did not run.">
          {params?.sync === "confirmation-required" ? "Confirm that you want to apply the student sync before it can run." : params?.sync === "not-connected" ? "Check the Arbor connection before syncing students." : params?.sync === "migration-required" ? "Anaxi is updating its database for student-sync audit records. Wait for the latest deployment to finish, then try again." : "No further changes were made after the issue was detected. Check the God Mode audit log."}
        </StatusBanner>
      ) : null}

      {params?.historicStudents === "success" ? (
        <StatusBanner variant="success" title="Historic pupils archived.">
          {previewCount(params.historicStudentCreated)} former pupils were added as archived records and {previewCount(params.historicStudentArchived)} existing records were archived. {previewCount(params.historicStudentSkipped)} could not be placed safely and were left unchanged.
        </StatusBanner>
      ) : null}
      {params?.historicStudents === "failed" || params?.historicStudents === "not-connected" || params?.historicStudents === "confirmation-required" ? (
        <StatusBanner variant="danger" title="Historic pupil archive did not run.">
          {params?.historicStudents === "confirmation-required" ? "Confirm the one-off archive run before it can start." : params?.historicStudents === "not-connected" ? "Check the Arbor connection before archiving historic pupils." : params?.historicStudentError || "No pupil records were changed."}
        </StatusBanner>
      ) : null}

      {params?.staff === "success" ? (
        <StatusBanner variant="success" title="Staff comparison complete.">
          {previewCount(params.activeInArbor)} active Arbor staff: {previewCount(params.linkedPrimaryOnly)} already linked to Primary, {previewCount(params.linkedSecondaryOnly)} to Secondary, {previewCount(params.linkedBoth)} to both schools; {previewCount(params.possiblePrimaryOnly)} possible Primary-only matches, {previewCount(params.possibleSecondaryOnly)} possible Secondary-only matches, {previewCount(params.possibleBoth)} possible cross-school matches, {previewCount(params.unmatched)} unmatched, and {previewCount(params.ambiguous)} ambiguous. Nothing has been changed.
        </StatusBanner>
      ) : null}

      {params?.staff === "failed" || params?.staff === "not-connected" ? (
        <StatusBanner variant="danger" title="Staff comparison could not run.">
          No staff records were changed.
        </StatusBanner>
      ) : null}

      {params?.staffSync === "success" ? (
        <StatusBanner variant="success" title="Staff sync complete.">
          {previewCount(params.linked)} existing Anaxi staff accounts were linked to Arbor. Their roles and access were not changed. Future nightly syncs can keep their names up to date safely.
        </StatusBanner>
      ) : null}

      {params?.staffSync === "failed" || params?.staffSync === "not-connected" || params?.staffSync === "confirmation-required" ? (
        <StatusBanner variant="danger" title="Staff sync did not run.">
          {params?.staffSync === "confirmation-required" ? "Confirm that you want to apply the staff sync before it can run." : params?.staffSync === "not-connected" ? "Check the Arbor connection before syncing staff." : "No further changes were made after the issue was detected. Check the God Mode audit log."}
        </StatusBanner>
      ) : null}
      {params?.staffProvisioning === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">New Arbor staff checked.</div><MetaText className="mt-1">{previewCount(params.staffProvisioningQueued)} staff record(s) were added to the approval queue. No account has been created yet.</MetaText></Card> : null}
      {params?.staffProvisioning === "provisioned" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Staff account created.</div><MetaText className="mt-1">The selected school account(s) were created or linked, and an invitation was sent.</MetaText></Card> : null}
      {params?.staffProvisioning === "failed" || params?.staffProvisioning === "invalid" || params?.staffProvisioning === "not-found" || params?.staffProvisioning === "not-connected" ? <Card className="border-error/30 bg-[var(--pill-error-bg)]"><div className="font-medium text-error">Staff provisioning needs attention.</div><MetaText className="mt-1">No new staff access was granted.</MetaText></Card> : null}

      {integration?.status === "CONNECTED" ? (
        <>
          <Card className="border-success/25">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-success">Connected and syncing nightly</div>
            <H3 className="mt-2 text-xl">Arbor is the source of truth for {integration.label}.</H3>
            <MetaText className="mt-2 max-w-3xl">Students, staff, attendance, behaviour, and profile photos update automatically for the schools attached to this connection.</MetaText>
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border/70 pt-5 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75] ${SECTION_TILE_CLASS.people}`} aria-hidden>{SECTION_ICON.people}</span>
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Schools</p>
                  <p className="mt-0.5 text-lg font-bold text-text">{selected.size} connected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75] ${SECTION_TILE_CLASS.assessments}`} aria-hidden>{SECTION_ICON.assessments}</span>
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Assessment cycles</p>
                  <p className="mt-0.5 text-lg font-bold text-text">{approvedAssessmentCycles.size ? `${approvedAssessmentCycles.size} approved` : "Awaiting review"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75] ${SECTION_TILE_CLASS.connection}`} aria-hidden>{SECTION_ICON.connection}</span>
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Connection</p>
                  <p className="mt-0.5 text-lg font-bold text-success">Healthy</p>
                </div>
              </div>
            </div>
          </Card>

          {attentionItems.length > 0 ? (
            <Card className="space-y-3 border-error/30 bg-[var(--pill-error-bg)]">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error text-xs font-bold text-white" aria-hidden>
                  {attentionItems.length}
                </span>
                <H3 className="text-error">Needs attention</H3>
              </div>
              <div className="divide-y divide-error/15 overflow-hidden rounded-sm border border-error/20 bg-[var(--surface-container-lowest)]">
                {attentionItems.map((item) => (
                  <a
                    key={item.key}
                    href={`#${item.key}`}
                    className="flex items-center gap-3 px-4 py-3 calm-transition hover:bg-[var(--pill-error-bg)]"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[1.75] ${SECTION_TILE_CLASS[item.key]}`} aria-hidden>
                      {SECTION_ICON[item.key]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--on-surface)]">{item.label}</span>
                      <span className="block truncate text-xs text-muted">{item.message}</span>
                    </span>
                    <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="space-y-3">
            <CollapsibleCard id="connection" title="1. Connection" icon={SECTION_ICON.connection} iconClassName={SECTION_TILE_CLASS.connection} defaultOpen={false} attention={visibleAlert("connection", connectionAlert)} attentionKey="connection" attentionFingerprint={connectionAlert ?? undefined} attentionMessage="The Arbor connection needs review. Check the connection result below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>{integration.label}</H3>
                  <MetaText className="mt-1">{integration.schools.map((school: { tenant: { name: string } }) => school.tenant.name).join(" and ")} share this Arbor connection while remaining separate Anaxi schools. Records are always routed to their existing school rather than guessed.</MetaText>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form method="post" action={connectionAction("/api/god/integrations/arbor/test")} className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <SubmitButton variant="secondary" className="w-full">Check connection</SubmitButton>
                  </form>
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard id="photos" title="2. Photo access" icon={SECTION_ICON.photos} iconClassName={SECTION_TILE_CLASS.photos} defaultOpen={false} attention={visibleAlert("photos", photoAlert)} attentionKey="photos" attentionFingerprint={photoAlert ?? undefined} attentionMessage="Arbor photo access needs review. Check the photo result below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Profile photos update automatically</H3>
                  <MetaText className="mt-1">Photos are copied from Arbor securely in small batches. Manually added Anaxi images remain untouched.</MetaText>
                </div>
                <form method="post" action={connectionAction("/api/god/integrations/arbor/test-photos")} className={actionButtonClass}>
                  <CsrfInput token={csrfToken} />
                  <SubmitButton variant="secondary" className="w-full">Check photo access</SubmitButton>
                </form>
              </div>
            </CollapsibleCard>

            <CollapsibleCard id="timetable" title="3. Timetable access" icon={SECTION_ICON.timetable} iconClassName={SECTION_TILE_CLASS.timetable} defaultOpen={false} attention={visibleAlert("timetable", timetableAlert)} attentionKey="timetable" attentionFingerprint={timetableAlert ?? undefined} attentionMessage="The timetable sync needs review. Check the latest result below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Subject teachers</H3>
                  <MetaText className="mt-1">Current Arbor teaching groups map each linked student to their teachers and subjects. Arbor-managed links update nightly across the whole roster; manually entered Anaxi links remain untouched.</MetaText>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form method="post" action={connectionAction("/api/god/integrations/arbor/sync/timetable")} className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <input type="hidden" name="confirm" value="SYNC_TIMETABLE" />
                    <SubmitButton variant="primary" className="w-full">Sync next subject-teacher page</SubmitButton>
                  </form>
                  <ActionMenu label="More checks">
                    <MenuItemForm action={connectionAction("/api/god/integrations/arbor/preview/timetable")} csrfToken={csrfToken}>Check timetable access</MenuItemForm>
                    <MenuItemForm action={connectionAction("/api/god/integrations/arbor/preview/timetable/summary")} csrfToken={csrfToken}>Preview subject links</MenuItemForm>
                  </ActionMenu>
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard id="people" title="4. Staff and student syncing" icon={SECTION_ICON.people} iconClassName={SECTION_TILE_CLASS.people} defaultOpen={false} attention={visibleAlert("people", peopleAlert)} attentionKey="people" attentionFingerprint={peopleAlert ?? undefined} attentionMessage="The people sync needs review. Check the latest result below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>People records update nightly</H3>
                  <MetaText className="mt-1">New active students, off-roll changes, linked staff details, and cross-school staff links are kept current automatically.</MetaText>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form method="post" action={connectionAction("/api/god/integrations/arbor/preview/students")} className={actionButtonClass}><CsrfInput token={csrfToken} /><SubmitButton variant="secondary" className="w-full">Check students</SubmitButton></form>
                  <form method="post" action={connectionAction("/api/god/integrations/arbor/preview/staff")} className={actionButtonClass}><CsrfInput token={csrfToken} /><SubmitButton variant="secondary" className="w-full">Check staff</SubmitButton></form>
                </div>
                <Card className="space-y-4" tone="inset">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">One-off setup</div>
                    <H3 className="mt-2">Historic pupil archive</H3>
                    <MetaText className="mt-1">Former Arbor pupils are added or moved to archived status so historic attainment remains attributable, without appearing in operational student lists. Records without enough information to identify Primary or Secondary are left unchanged.</MetaText>
                  </div>
                  <form method="post" action={connectionAction("/api/god/integrations/arbor/sync/historic-students")} className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <input type="hidden" name="confirm" value="ARCHIVE_HISTORIC_STUDENTS" />
                    <SubmitButton variant="secondary" className="w-full">Archive historic pupils</SubmitButton>
                  </form>
                </Card>
              </div>
            </CollapsibleCard>

            <CollapsibleCard id="behaviour" title="5. Behaviour syncing" icon={SECTION_ICON.behaviour} iconClassName={SECTION_TILE_CLASS.behaviour} defaultOpen={false} attention={visibleAlert("behaviour", behaviourAlert)} attentionKey="behaviour" attentionFingerprint={behaviourAlert ?? undefined} attentionMessage="The latest behaviour sync needs review. Check the error below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div className="space-y-4">
                <H3>Behaviour data updates nightly</H3>
                <MetaText className="mt-1">Positive points, detentions, internal exclusions, and suspensions are imported into Anaxi&apos;s existing behaviour measures. No manual behaviour upload is needed.</MetaText>
                {latestBehaviourRun?.status === "SUCCESS" ? <MetaText>Last sync: {previewCount(String(latestBehaviourRun.recordsCreated))} new and {previewCount(String(latestBehaviourRun.recordsUpdated))} refreshed daily snapshots. Nightly catch-up continues automatically.</MetaText> : null}
                {behaviourNeedsAttention ? <StatusBanner variant="danger" title="Latest behaviour sync needs attention.">{latestBehaviourRun?.errorSummary ?? "No further behaviour changes were made after the issue was detected."}</StatusBanner> : null}
              </div>
            </CollapsibleCard>

            <CollapsibleCard id="attendance" title="6. Attendance syncing" icon={SECTION_ICON.attendance} iconClassName={SECTION_TILE_CLASS.attendance} defaultOpen={false} attention={visibleAlert("attendance", attendanceAlert)} attentionKey="attendance" attentionFingerprint={attendanceAlert ?? undefined} attentionMessage="The attendance sync needs review. Check the latest result below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div>
                <H3>Attendance updates nightly</H3>
                <MetaText className="mt-1">Academic-year attendance totals and daily snapshots refresh automatically. Anaxi then compares the selected 7, 14, 21, or 28-day period with the previous period.</MetaText>
              </div>
            </CollapsibleCard>

            <CollapsibleCard id="leave" title="7. Leave of absence syncing" icon={SECTION_ICON.leave} iconClassName={SECTION_TILE_CLASS.leave} defaultOpen={false} attention={visibleAlert("leave", leaveAlert)} attentionKey="leave" attentionFingerprint={leaveAlert ?? undefined} attentionMessage="Arbor staff-absence access needs review. Check the permission result below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Check Arbor staff-absence access</H3>
                  <MetaText className="mt-1">Before Anaxi sends an approved leave request to Arbor, confirm that the Anaxi application can read the staff-absence area and whether Arbor advertises a relevant write operation. This check is read-only and never creates or changes an absence.</MetaText>
                </div>
                {params?.leaveAccess === "success" ? (
                  <StatusBanner variant="success" title="Arbor staff-absence read access verified.">
                    Anaxi can read the staff-absence area. Arbor reported {previewCount(params.leaveWriteOperations)} relevant write operation{previewCount(params.leaveWriteOperations) === 1 ? "" : "s"}; this is not permission to write yet. We will confirm the exact create/update contract before enabling an approved-leave sync.
                  </StatusBanner>
                ) : null}
                {leaveNeedsAttention ? (
                  <StatusBanner variant="danger" title="Arbor staff-absence access needs attention.">
                    {params?.leaveAccess === "not-connected" ? "Check the main Arbor connection first." : "Arbor did not allow the read-only staff-absence check. No leave data was changed."}
                  </StatusBanner>
                ) : null}
                <form method="post" action={connectionAction("/api/god/integrations/arbor/test-staff-absence")} className={actionButtonClass}>
                  <CsrfInput token={csrfToken} />
                  <SubmitButton variant="secondary" className="w-full">Check leave access</SubmitButton>
                </form>
              </div>
            </CollapsibleCard>

            <CollapsibleCard id="assessments" title="8. Assessment syncing" icon={SECTION_ICON.assessments} iconClassName={SECTION_TILE_CLASS.assessments} defaultOpen={false} attention={visibleAlert("assessments", assessmentAlert)} attentionKey="assessments" attentionFingerprint={assessmentAlert ?? undefined} attentionMessage="Assessment review needs attention. Check the cycle status below before acknowledging it." connectionId={integration.id} csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Assessment review</H3>
                  <MetaText className="mt-1">This is the only data area that requires a decision before it appears in Anaxi.</MetaText>
                </div>
                {params?.assessmentHistory === "progress" || params?.assessmentHistory === "complete" ? (
                  <StatusBanner variant="success" title={params.assessmentHistory === "complete" ? "Historic assessment discovery complete." : "Historic assessment discovery updated."}>
                    {previewCount(params.assessmentHistoryCycles)} dated Arbor cycle(s) are now available for review. This pass read {previewCount(params.assessmentHistoryBatches)} Arbor subject batches and accepted {previewCount(params.assessmentHistoryAccepted)} matching rosters. {params.assessmentHistoryReasons ? `Mapping detail: ${params.assessmentHistoryReasons}. ` : ""}{params.assessmentHistory === "complete" ? "No results have been imported." : "Continue the controlled batch scan with Find historic cycles."}
                  </StatusBanner>
                ) : null}
                {params?.assessmentHistory === "failed" ? (
                  <StatusBanner variant="danger" title="Historic assessment discovery could not run.">
                    {params.assessmentHistoryError || "No assessment data was imported."}
                  </StatusBanner>
                ) : null}
                <Card className="space-y-4" tone="inset">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Controlled import</div>
                    <H3 className="mt-2">Proposed assessment cycles</H3>
                    <MetaText className="mt-1">Review and approve only the cycles you want to bring in. Each uses the agreed year group, phase, and term naming convention.</MetaText>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form method="post" action={connectionAction("/api/god/integrations/arbor/preview/assessments/history")} className={actionButtonClass}>
                      <CsrfInput token={csrfToken} />
                      <SubmitButton variant="primary" className="w-full">{assessmentSync.historicComplete ? "Recheck historic cycles" : "Find historic cycles"}</SubmitButton>
                    </form>
                    <form method="post" action={connectionAction("/api/god/integrations/arbor/preview/assessments/active")} className={actionButtonClass}>
                      <CsrfInput token={csrfToken} />
                      <SubmitButton variant="secondary" className="w-full">Refresh catalogue</SubmitButton>
                    </form>
                    <ActionMenu label="Diagnostics">
                      <MenuItemForm action={connectionAction("/api/god/integrations/arbor/preview/assessments/periods")} csrfToken={csrfToken}>Check assessment periods</MenuItemForm>
                      <MenuItemForm action={connectionAction("/api/god/integrations/arbor/preview/assessments/sources")} csrfToken={csrfToken}>Check historic sources</MenuItemForm>
                      <MenuItemForm action={connectionAction("/api/god/integrations/arbor/preview/assessments/source-fields")} csrfToken={csrfToken}>Inspect historic source fields</MenuItemForm>
                    </ActionMenu>
                  </div>
                </div>

                <MetaText>{assessmentSync.historicComplete
                  ? "Historic assessment discovery is complete. Every matching Arbor mark-sheet target has been checked and the cycles below are ready for review."
                  : `Historic assessment discovery is reading the agreed P8 GCSE, A-Level, Year 10 percentage, and KS3 percentage definitions through Arbor's subject batch rosters. ${typeof assessmentSync.historicBatchDefinitionOffset === "number" && Array.isArray(assessmentSync.definitions) ? `${Math.min(assessmentSync.historicBatchDefinitionOffset, assessmentSync.definitions.length)} of ${assessmentSync.definitions.length} prepared definitions have been checked. ` : ""}Each pass uses only the pupils and marks assigned by Arbor to that subject.`}</MetaText>

                {approvedAssessmentCycles.size ? (
                  <div className="rounded-sm border border-success/25 bg-success/5 p-4">
                    <H3 className="text-base">Assessment import progress</H3>
                    <MetaText className="mt-1">{approvedAssessmentCycles.size} approved {approvedAssessmentCycles.size === 1 ? "cycle is" : "cycles are"} ready to import. Only verified, graded marks from the reviewed subject sheets are written to Attainment.</MetaText>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <form method="post" action={connectionAction("/api/god/integrations/arbor/sync/assessments")}>
                        <CsrfInput token={csrfToken} />
                        <input type="hidden" name="runNow" value="1" />
                        <SubmitButton className={actionButtonClass}>Import approved results now</SubmitButton>
                      </form>
                      <MetaText>Each run imports up to 4 reviewed subject sheets now; {assessmentImportRemaining} of {approvedAssessmentDefinitionCount} approved sheet{approvedAssessmentDefinitionCount === 1 ? "" : "s"} remain{assessmentImportRemaining ? "." : " complete."}</MetaText>
                    </div>
                    {assessmentImportProgress ? (
                      <MetaText className="mt-2">Last imported: {String(assessmentImportProgress.label ?? "reviewed assessment")} · {previewCount(String(assessmentImportProgress.imported))} mark{previewCount(String(assessmentImportProgress.imported)) === 1 ? "" : "s"} written from {previewCount(String(assessmentImportProgress.reviewedMarks))} verified mark{previewCount(String(assessmentImportProgress.reviewedMarks)) === 1 ? "" : "s"}{typeof assessmentImportProgress.at === "string" ? ` · ${new Date(assessmentImportProgress.at).toLocaleString("en-GB")}` : ""}.</MetaText>
                    ) : (
                      <MetaText className="mt-2">No approved marks have been imported yet.</MetaText>
                    )}
                    <MetaText className="mt-2">Total verified marks imported: {typeof assessmentSync.importedMarks === "number" ? assessmentSync.importedMarks : 0}.</MetaText>
                  </div>
                ) : null}

                {assessmentCycles.length ? (
                  <form method="post" action={connectionAction("/api/god/integrations/arbor/assessments/approval")} className="space-y-4">
                    <CsrfInput token={csrfToken} />
                    <div className="space-y-3">
                      {assessmentYears.map((academicYear) => {
                        const cycles = assessmentCyclesByYear.get(academicYear) ?? [];
                        const approved = cycles.filter((cycle) => approvedAssessmentCycles.has(cycle.key)).length;
                        return (
                          <details key={academicYear} className="rounded-sm border border-border/70 bg-[var(--surface-container-lowest)]">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                              <span>{academicYear}</span>
                              <MetaText>{cycles.length} proposed {cycles.length === 1 ? "cycle" : "cycles"}{approved ? ` · ${approved} approved` : ""} · manage cycles</MetaText>
                            </summary>
                            <div className="divide-y divide-border/70 border-t border-border/70">
                              {cycles.map((cycle) => {
                                const students = studentCountByYearGroup.get(cycle.yearGroup) ?? 0;
                                return (
                                  <div key={cycle.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                                    <label className="flex min-w-0 cursor-pointer items-start gap-3">
                                      <input type="checkbox" name="cycleKey" value={cycle.key} defaultChecked={approvedAssessmentCycles.has(cycle.key)} className="mt-1 accent-accent" />
                                      <span className="min-w-0">
                                        <span className="block font-medium">{cycle.label}</span>
                                        <MetaText className="mt-1">{cycle.gradeFormat} · {students} active {students === 1 ? "student" : "students"} · {cycle.definitions.length} Arbor {cycle.definitions.length === 1 ? "definition" : "definitions"}</MetaText>
                                        <MetaText className="mt-1 break-words">{cycle.definitions.slice(0, 3).join(" · ")}{cycle.definitions.length > 3 ? ` +${cycle.definitions.length - 3} more` : ""}</MetaText>
                                      </span>
                                    </label>
                                    <div className="flex shrink-0 items-center gap-3">
                                      <Link href={assessmentReviewHref(cycle.key, integration.id)} className="text-sm font-semibold text-accent underline underline-offset-4">Open review</Link>
                                      <button type="submit" name="deleteCycleKey" value={cycle.key} className="rounded-sm border border-error/35 bg-[var(--pill-error-bg)] px-3 py-1.5 text-sm font-semibold text-error hover:border-error/60">Remove cycle</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
                      <SubmitButton className={actionButtonClass}>Save approved cycles</SubmitButton>
                      <MetaText>{assessmentDiscoveryComplete
                        ? (approvedAssessmentCycles.size ? `${approvedAssessmentCycles.size} cycle(s) are currently approved.` : "All assessment imports are currently paused.")
                        : "Discovery is still in progress. You can approve the reviewed cycles now; remaining definitions will stay unapproved until you review them."}</MetaText>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-sm border border-dashed border-border bg-[var(--surface-container-low)] p-5">
                    <H3>No assessment cycles are ready to review yet</H3>
                    <MetaText className="mt-1">{Array.isArray(assessmentSync.definitions) && assessmentSync.definitions.length
                      ? "Click Find historic cycles to read the prepared Arbor definitions through their subject mark-sheet targets. This is read-only."
                      : "Click Find historic cycles to prepare the agreed P8 GCSE, A-Level, KS3 percentage, Year 10 percentage, and final-result definitions, then start the dated review. This is read-only."}</MetaText>
                  </div>
                )}

                {approvedAssessmentCycles.size ? (
                  <form method="post" action={connectionAction("/api/god/integrations/arbor/assessments/approval")} className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <input type="hidden" name="action" value="pause" />
                    <SubmitButton variant="ghost" className="w-full">Pause all assessment imports</SubmitButton>
                  </form>
                ) : null}
                </Card>
              </div>
            </CollapsibleCard>
          </div>
        </>
      ) : integration?.credentialsCiphertext ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <H3>Check the Arbor connection</H3>
            <MetaText className="mt-1">This makes one read-only request to Arbor. It does not import or change data.</MetaText>
          </div>
          <form method="post" action={connectionAction("/api/god/integrations/arbor/test")} className={actionButtonClass}>
            <CsrfInput token={csrfToken} />
            <SubmitButton variant="secondary" className="w-full">Check connection</SubmitButton>
          </form>
        </Card>
      ) : null}

      {params?.comparison === "success" && previewCount(params.ambiguousMatch) === 0 && previewCount(params.needsReview) === 0 ? (
        <Card className="border-warning/30 bg-[var(--pill-warning-bg)]">
          <form method="post" action={connectionAction("/api/god/integrations/arbor/sync/students")} className="space-y-3">
            <CsrfInput token={csrfToken} />
            <div>
              <H3>Apply the first student sync</H3>
              <MetaText className="mt-1">This will link {previewCount(params.possibleMatch)} existing Anaxi students to Arbor and add {previewCount(params.newStudent)} new students. Off-roll records stay untouched. Every change is recorded in the God Mode audit trail.</MetaText>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input required type="checkbox" name="confirm" value="SYNC_STUDENTS" className="mt-1 accent-accent" />
              <span>I have reviewed the comparison and want to apply this student sync.</span>
            </label>
            <SubmitButton className={actionButtonClass}>Apply student sync</SubmitButton>
          </form>
        </Card>
      ) : null}

      {params?.staff === "success" && previewCount(params.ambiguous) === 0 && (previewCount(params.possiblePrimaryOnly) + previewCount(params.possibleSecondaryOnly) + previewCount(params.possibleBoth)) > 0 ? (
        <Card className="border-warning/30 bg-[var(--pill-warning-bg)]">
          <form method="post" action={connectionAction("/api/god/integrations/arbor/sync/staff")} className="space-y-3">
            <CsrfInput token={csrfToken} />
            <div>
              <H3>Apply the first staff sync</H3>
              <MetaText className="mt-1">This will link {previewCount(params.possiblePrimaryOnly) + previewCount(params.possibleSecondaryOnly) + previewCount(params.possibleBoth)} existing Anaxi staff accounts to Arbor, including cross-school staff. It does not change roles, permissions, passwords, or create the {previewCount(params.unmatched)} unmatched staff accounts.</MetaText>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input required type="checkbox" name="confirm" value="SYNC_STAFF" className="mt-1 accent-accent" />
              <span>I have reviewed the comparison and want to link these existing staff accounts to Arbor.</span>
            </label>
            <SubmitButton className={actionButtonClass}>Apply staff sync</SubmitButton>
          </form>
        </Card>
      ) : null}

      <Card>
        <form method="post" action={connectionAction("/api/god/integrations/arbor")} className="space-y-5">
          <CsrfInput token={csrfToken} />
          {integration ? <input type="hidden" name="connectionId" value={integration.id} /> : null}
          <div className="space-y-4">
            <div>
              <H3>Arbor application credentials</H3>
              <MetaText className="mt-1">Use the dedicated credentials for the Anaxi app in Arbor&apos;s Developer Portal, not a staff member&apos;s Arbor email and password. These details are stored encrypted and are never shown again after saving.</MetaText>
            </div>
            <FormField id="schoolHostname" label="Arbor school name" required hint={<>Enter the part before <code>.uk.arbor.sc</code>, not the full web address.</>}>
              <input id="schoolHostname" name="schoolHostname" required defaultValue={hostname} className="field" placeholder="goresbrook" autoCapitalize="none" />
            </FormField>
            <FormField id="label" label="Connection name" required hint="Use the real school name, for example “Goresbrook Arbor”.">
              <input id="label" name="label" required defaultValue={integration?.label ?? ""} className="field" placeholder="School name Arbor" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="username" label="Arbor API username" required hint="The Anaxi app username from Arbor's Developer Portal.">
                <input id="username" name="username" required className="field" autoComplete="off" />
              </FormField>
              <FormField id="password" label="Arbor API password" required hint="The matching app password or secret from Arbor's Developer Portal.">
                <input id="password" name="password" required type="password" className="field" autoComplete="new-password" />
              </FormField>
            </div>
          </div>

          <fieldset className="space-y-3 border-t border-border/70 pt-5">
            <legend className="p-0">
              <H3>Schools that receive Arbor data</H3>
            </legend>
            <MetaText>Attach every Anaxi view that belongs to this real school. Their data remains separated inside Anaxi.</MetaText>
            <div className="grid gap-2 sm:grid-cols-2">
              {schools.map((school) => (
                <label key={school.id} className="flex items-center gap-3 rounded-sm border border-border/70 bg-surface/60 px-3 py-3 text-sm">
                  <input type="checkbox" name="tenantIds" value={school.id} defaultChecked={selected.has(school.id)} className="accent-accent" />
                  <span>
                    <span className="block font-medium">{school.name}</span>
                    <MetaText>{school.tenantSettings?.schoolType === "PRIMARY" ? "Primary" : "Secondary"} · {school.status.toLowerCase()}</MetaText>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton className={actionButtonClass}>{integration ? "Save this Arbor connection" : "Create Arbor connection"}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
