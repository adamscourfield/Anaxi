"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { TenantSchoolType } from "@/lib/tenantSchoolType";
import { DEFAULT_CONTEXT, loadDraft, persistDraft, Phase } from "./observationDraft";
import { ObservationStageLayout } from "./ObservationStageLayout";

type Teacher = { id: string; fullName: string; email: string };
type Department = { id: string; name: string };

const THRESHOLD_PHASE_OPTION: { key: Phase; label: string; icon: React.ReactNode } = {
    key: "THRESHOLD",
    label: "Threshold",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="8" r="1.25" fill="currentColor" />
      </svg>
    ),
};

const TRANSITION_START_PHASE_OPTION: { key: Phase; label: string; icon: React.ReactNode } = {
  key: "TRANSITION_START",
  label: "Transition / start",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="8" r="1.25" fill="currentColor" />
    </svg>
  ),
};

const PHASE_OPTIONS_BASE: { key: Phase; label: string; icon: React.ReactNode }[] = [
  {
    key: "INSTRUCTION",
    label: "Instruction",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 18c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 8c1-1 2.5-1 3.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4.5 8c1-1 2.5-1 3.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "GUIDED_PRACTICE",
    label: "Guided Practice",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <path d="M12 4v2M12 18v2M4 12h2M18 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "INDEPENDENT_PRACTICE",
    label: "Independent",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 9h16" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 13h4M8 16h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "UNKNOWN",
    label: "Not Sure",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10a2 2 0 1 1 2 2v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "BOOKS",
    label: "Book Look",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 6.5C2 5.12 3.12 4 4.5 4H12v16H4.5A2.5 2.5 0 0 1 2 17.5v-11z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 4h7.5A2.5 2.5 0 0 1 22 6.5v11A2.5 2.5 0 0 1 19.5 20H12V4z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 4v16" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

function phaseOptionsForSchoolType(schoolType: TenantSchoolType) {
  const start =
    schoolType === "PRIMARY" ? TRANSITION_START_PHASE_OPTION : THRESHOLD_PHASE_OPTION;
  return [start, ...PHASE_OPTIONS_BASE];
}

export function ObservationContextForm({
  teachers,
  departments,
  draftKey,
  signalKeys,
  schoolType,
}: {
  teachers: Teacher[];
  departments: Department[];
  draftKey: string;
  signalKeys: string[];
  schoolType: TenantSchoolType;
}) {
  const router = useRouter();
  const phaseOptions = useMemo(() => phaseOptionsForSchoolType(schoolType), [schoolType]);
  const initial = useMemo(() => loadDraft(draftKey, signalKeys).context, [draftKey, signalKeys]);
  const [context, setContext] = useState(initial || DEFAULT_CONTEXT);

  // Map legacy THRESHOLD ↔ TRANSITION_START when school type implies a different start phase.
  useEffect(() => {
    if (schoolType === "PRIMARY" && context.phase === "THRESHOLD") {
      setContext((c) => ({ ...c, phase: "TRANSITION_START" }));
    }
    if (schoolType === "SECONDARY" && context.phase === "TRANSITION_START") {
      setContext((c) => ({ ...c, phase: "THRESHOLD" }));
    }
  }, [schoolType, context.phase]);

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ value: t.id, label: t.fullName, detail: t.email })),
    [teachers]
  );
  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  );

  const canContinue = Boolean(context.teacherId && context.department && context.classCode.trim());

  return (
    <ObservationStageLayout currentStep={1}>
      {/* Main Card */}
      <div className="home-hero-glass min-w-0 w-full overflow-hidden rounded-sm border border-border shadow-none">
        <div className="px-4 py-6 sm:px-8 sm:py-8">
          {/* Stage Header */}
          <div className="mb-8">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-[var(--tertiary-container)] text-[var(--on-primary)] shadow-none [&_svg]:h-5 [&_svg]:w-5">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-[1.125rem] font-bold tracking-[-0.02em] text-text">Stage 1: Session Details</h2>
                <p className="mt-1.5 text-pretty text-[0.875rem] leading-relaxed text-muted">
                  Define the context and primary actor for this observation period.
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields - 2 Column Grid */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {/* Teacher Name */}
            <div className="space-y-2">
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                Teacher Name
              </label>
              <SearchableSelect
                options={teacherOptions}
                value={context.teacherId}
                onChange={(value) => setContext((c) => ({ ...c, teacherId: value }))}
                placeholder="Search teacher profile…"
                searchPlaceholder="Search by name or email…"
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                Department
              </label>
              <SearchableSelect
                options={departmentOptions}
                value={context.department}
                onChange={(value) => {
                  const dept = departments.find((d) => d.id === value);
                  setContext((c) => ({
                    ...c,
                    department: value,
                    subject: dept?.name || "",
                  }));
                }}
                placeholder="Select department"
                searchPlaceholder="Search department…"
              />
            </div>

            {/* Class / Set */}
            <div className="space-y-2">
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                Class / Set
              </label>
              <div className="relative">
                <input
                  className="field"
                  placeholder="e.g. Year 10 Set A"
                  value={context.classCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    const yearMatch = val.match(/(?:year|y|grade|gr)\s*(\d{1,2})/i)
                      || val.match(/^(\d{1,2})\s*[A-Za-z]/);
                    setContext((c) => ({
                      ...c,
                      classCode: val,
                      yearGroup: yearMatch ? yearMatch[1] : val.trim(),
                    }));
                  }}
                />
              </div>
            </div>

            {/* Date of Observation */}
            <div className="space-y-2">
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                Date of Observation
              </label>
              <div className="relative">
                <input
                  type="date"
                  className="field"
                  value={context.observedAt}
                  onChange={(e) => setContext((c) => ({ ...c, observedAt: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Current Lesson Stage */}
          <div className="mt-8">
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
              Current Lesson Stage
            </label>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Select the specific pedagogical phase currently being observed.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {phaseOptions.map((phase) => {
                const selected = context.phase === phase.key;
                return (
                  <button
                    key={phase.key}
                    type="button"
                    onClick={() => setContext((c) => ({ ...c, phase: phase.key }))}
                    className={`flex flex-col items-center gap-2.5 rounded-lg border-2 px-4 py-4 text-center calm-transition ${
                      selected
                        ? "border-[var(--tertiary-container)] bg-[color-mix(in_srgb,var(--tertiary-container)_10%,var(--surface-container-lowest))] text-text shadow-sm ring-1 ring-[color-mix(in_srgb,var(--tertiary-container)_15%,transparent)]"
                        : "border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)]/80 text-muted hover:border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] hover:bg-[var(--surface-container-low)]"
                    }`}
                  >
                    <span className={selected ? "text-[var(--tertiary-container)]" : "text-muted"}>{phase.icon}</span>
                    <span className="text-[0.8125rem] font-semibold leading-tight">{phase.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex items-center gap-2 text-[0.875rem] font-medium text-muted calm-transition hover:text-text"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Cancel Session
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              persistDraft(draftKey, {
                context,
                signalState: loadDraft(draftKey, signalKeys).signalState,
              });
              router.push("/observe/new/signals");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--tertiary-container)] px-7 py-3 text-[0.875rem] font-semibold text-[var(--on-primary)] shadow-none calm-transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next Stage
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 sm:p-6">
          <div className="mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-scale-limited-bar">
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h3 className="text-[0.875rem] font-bold text-text">Observation Protocol</h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            Ensure you have notified the staff member at least 24 hours prior to entering the classroom environment.
          </p>
        </div>
        <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 sm:p-6">
          <div className="mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-scale-limited-bar">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7" cy="14.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M11 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="text-[0.875rem] font-bold text-text">Historical Data</h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            The system will automatically link previous observation trends to this teacher&apos;s final ledger report.
          </p>
        </div>
        <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 sm:p-6">
          <div className="mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-cat-violet-text">
              <path d="M4 16l4-8 4 6 4-10 4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-[0.875rem] font-bold text-text">Real-time Insights</h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            Stage 2 will allow you to capture specific pedagogical metrics using the Anaxi Intelligence toolkit.
          </p>
        </div>
      </div>
    </ObservationStageLayout>
  );
}
