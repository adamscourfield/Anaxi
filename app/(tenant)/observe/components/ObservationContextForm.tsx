"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DEFAULT_CONTEXT, loadDraft, persistDraft, Phase } from "./observationDraft";
import { ObservationStageLayout } from "./ObservationStageLayout";

type Teacher = { id: string; fullName: string; email: string };
type Department = { id: string; name: string };

const PHASE_OPTIONS: { key: Phase; label: string; icon: React.ReactNode }[] = [
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
];

export function ObservationContextForm({
  teachers,
  departments,
  draftKey,
  signalKeys,
}: {
  teachers: Teacher[];
  departments: Department[];
  draftKey: string;
  signalKeys: string[];
}) {
  const router = useRouter();
  const initial = useMemo(() => loadDraft(draftKey, signalKeys).context, [draftKey, signalKeys]);
  const [context, setContext] = useState(initial || DEFAULT_CONTEXT);

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
      <div className="min-w-0 w-full rounded-2xl glass-card">
        <div className="px-4 py-6 sm:px-8 sm:py-7">
          {/* Stage Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-text" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <h2 className="text-[1.125rem] font-bold tracking-tight text-text">
                Stage 1: Session Details
              </h2>
            </div>
            <p className="mt-1.5 ml-0 text-pretty text-[0.875rem] text-muted sm:ml-[30px]">
              Define the context and primary actor for this observation period.
            </p>
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
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PHASE_OPTIONS.map((phase) => {
                const selected = context.phase === phase.key;
                return (
                  <button
                    key={phase.key}
                    type="button"
                    onClick={() => setContext((c) => ({ ...c, phase: phase.key }))}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-center calm-transition ${
                      selected
                        ? "border-primary bg-primary/[0.06] text-primary shadow-sm"
                        : "border-border/30 bg-surface-container-lowest/70 text-muted hover:border-border hover:bg-surface-container-lowest/90"
                    }`}
                  >
                    <span className={selected ? "text-primary" : "text-muted"}>{phase.icon}</span>
                    <span className="text-[0.8125rem] font-semibold leading-tight">{phase.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-border/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex items-center gap-2 text-[0.875rem] font-medium text-muted calm-transition hover:text-text"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
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
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[0.875rem] font-semibold text-on-primary shadow-[0_4px_16px_rgba(0,0,0,0.14)] calm-transition hover:bg-primary-container hover:shadow-[0_6px_20px_rgba(0,0,0,0.20)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next Stage
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-container border border-border/20 p-5">
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
        <div className="rounded-2xl bg-surface-container border border-border/20 p-5">
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
        <div className="rounded-2xl bg-surface-container border border-border/20 p-5">
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
