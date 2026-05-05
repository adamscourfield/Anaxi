"use client";

import type { ReactNode } from "react";
import { FormWithSuccessToast, FormSuccessToast } from "@/components/form-success-toast";

const PLATFORM_CARD =
  "rounded-2xl border border-border/35 bg-surface-container-lowest shadow-[0_2px_16px_rgba(15,23,42,0.06)]";

const FIELD_SHELL = "field w-full rounded-xl border-border/40 bg-surface-container-lowest";

const LABEL_UPPER = "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted";

type Tab = "school" | "modules";

type FeatureVisual = { well: string; icon: ReactNode };

function featureVisual(key: string): FeatureVisual {
  const iconClass = "h-[18px] w-[18px]";
  const stroke = { stroke: "currentColor", strokeWidth: 1.75, fill: "none" } as const;

  const visuals: Record<string, FeatureVisual> = {
    ADMIN: {
      well: "bg-[rgba(99,102,241,0.12)] text-[#4f46e5]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
          <path d="M9 9v0M9 12v0M9 15v0" />
        </svg>
      ),
    },
    ADMIN_SETTINGS: {
      well: "bg-[rgba(59,130,246,0.12)] text-[#2563eb]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    ANALYSIS: {
      well: "bg-[rgba(16,185,129,0.12)] text-[#059669]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-6 4 3 5-8" />
        </svg>
      ),
    },
    ASSESSMENTS: {
      well: "bg-[rgba(245,158,11,0.14)] text-[#b45309]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      ),
    },
    BEHAVIOUR_IMPORT: {
      well: "bg-[rgba(59,130,246,0.12)] text-[#2563eb]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M12 3v12M8 11l4 4 4-4" />
          <path d="M4 21h16" />
        </svg>
      ),
    },
    LEAVE: {
      well: "bg-[rgba(99,102,241,0.12)] text-[#4f46e5]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M9 16l2 2 4-4" />
        </svg>
      ),
    },
    MEETINGS: {
      well: "bg-[rgba(16,185,129,0.12)] text-[#059669]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    OBSERVATIONS: {
      well: "bg-[rgba(245,158,11,0.14)] text-[#b45309]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    ON_CALL: {
      well: "bg-[rgba(59,130,246,0.12)] text-[#2563eb]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      ),
    },
    SIGNALS: {
      well: "bg-[rgba(99,102,241,0.12)] text-[#4f46e5]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    STUDENTS: {
      well: "bg-[rgba(16,185,129,0.12)] text-[#059669]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      ),
    },
    STUDENTS_IMPORT: {
      well: "bg-[rgba(59,130,246,0.12)] text-[#2563eb]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M20 8v6M23 11h-6" />
        </svg>
      ),
    },
    STUDENT_ANALYSIS: {
      well: "bg-[rgba(16,185,129,0.12)] text-[#059669]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <path d="M3 3v18h18" />
          <path d="M7 15l3-3 3 2 5-6" />
        </svg>
      ),
    },
    TIMETABLE: {
      well: "bg-[rgba(245,158,11,0.14)] text-[#b45309]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
  };

  return (
    visuals[key] ?? {
      well: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" {...stroke}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    }
  );
}

export function AdminSettingsForms({
  tab,
  settings,
  features,
  saveSettings,
  toggleFeature,
}: {
  tab: Tab;
  settings: {
    schoolName: string | null;
    timezone: string | null;
    defaultInsightWindowDays: number | null;
    driftDeltaThreshold: number | null;
    minObservationCount: number | null;
    behaviourSpikePercent: number | null;
  } | null;
  features: Array<{ key: string; enabled: boolean }>;
  saveSettings: (formData: FormData) => Promise<void>;
  toggleFeature: (formData: FormData) => Promise<void>;
}) {
  const FEATURE_FRIENDLY_NAMES: Record<string, string> = {
    OBSERVATIONS: "Observations",
    SIGNALS: "Signals & Analysis",
    STUDENTS: "Students",
    STUDENTS_IMPORT: "Student Import",
    BEHAVIOUR_IMPORT: "Behaviour Import",
    LEAVE: "Leave of Absence",
    ON_CALL: "On Call",
    MEETINGS: "Meetings",
    TIMETABLE: "Timetable",
    ADMIN: "Administration",
    ADMIN_SETTINGS: "Admin Settings",
    ANALYSIS: "Analytics & Insights",
    STUDENT_ANALYSIS: "Student Analysis",
    ASSESSMENTS: "Assessments",
  };

  const FEATURE_DESCRIPTIONS: Record<string, string> = {
    OBSERVATIONS: "Observation workflows, review history, and signal capture.",
    SIGNALS: "Signal definitions and signal-based analysis capabilities.",
    STUDENTS: "Student directory, student views, and related workflows.",
    STUDENTS_IMPORT: "Student import tooling and mapping workflows.",
    BEHAVIOUR_IMPORT: "Behaviour snapshot and attendance import workflows.",
    LEAVE: "Leave request and approval workflows.",
    ON_CALL: "On-call request, inbox, and response workflows.",
    MEETINGS: "Meeting agendas, attendees, and actions.",
    TIMETABLE: "Timetable upload and class context enrichment.",
    ADMIN: "Admin configuration pages and management tools.",
    ADMIN_SETTINGS: "Tenant-level settings and configuration pages.",
    ANALYSIS: "Teacher and school analysis dashboards.",
    STUDENT_ANALYSIS: "Student risk and student-level analysis pages.",
    ASSESSMENTS: "Assessment cycles, mock results, grade tracking, and key measures dashboards for GCSE and A Level.",
  };

  if (tab === "school") {
    return (
      <div className={`overflow-hidden ${PLATFORM_CARD}`}>
        <div className="border-b border-border/20 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex gap-3 sm:gap-4">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(124,105,239,0.88)] text-white shadow-sm [&_svg]:shrink-0"
              aria-hidden
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 21h16M6 21V10l6-4 6 4v11M10 21v-6h4v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-text">School details</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                Set the school name, timezone, and default insight window.
              </p>
            </div>
          </div>
        </div>
        <FormWithSuccessToast
          action={saveSettings}
          successMessage="Settings saved"
          className="space-y-5 px-5 py-6 sm:space-y-6 sm:px-7 sm:pb-7"
        >
          <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL_UPPER} htmlFor="platform-school-name">
                School name
              </label>
              <input
                id="platform-school-name"
                name="schoolName"
                defaultValue={settings?.schoolName ?? ""}
                placeholder="My School"
                className={FIELD_SHELL}
              />
            </div>
            <div>
              <label className={LABEL_UPPER} htmlFor="platform-timezone">
                Timezone
              </label>
              <select
                id="platform-timezone"
                name="timezone"
                defaultValue={settings?.timezone ?? "Europe/London"}
                className={FIELD_SHELL}
              >
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Dublin">Europe/Dublin</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
              </select>
            </div>
            <div>
              <label className={LABEL_UPPER} htmlFor="platform-insight-window">
                Default insight window
              </label>
              <select
                id="platform-insight-window"
                name="defaultInsightWindowDays"
                defaultValue={String(settings?.defaultInsightWindowDays ?? 21)}
                className={FIELD_SHELL}
              >
                <option value="7">7 days</option>
                <option value="21">21 days</option>
                <option value="28">28 days</option>
              </select>
            </div>
          </div>

          <details className="group max-w-3xl rounded-xl border border-border/40 bg-surface-container-lowest">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 calm-transition hover:bg-surface-container-low/40 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--surface-container-low)_70%,transparent)] text-muted">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 21v-7M4 10V8a2 2 0 012-2h6a2 2 0 012 2v2M4 21h16M8 21v-9M12 21v-5M16 21v-3M20 10v11" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 8h1M11 8h1M15 8h1" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 text-[0.9375rem] font-bold text-text">Advanced thresholds</span>
              <svg
                className="h-5 w-5 shrink-0 text-muted calm-transition group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="border-t border-border/25 px-4 py-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={LABEL_UPPER} htmlFor="platform-drift">
                    Drift delta
                  </label>
                  <input
                    id="platform-drift"
                    type="number"
                    step="0.01"
                    name="driftDeltaThreshold"
                    defaultValue={settings?.driftDeltaThreshold ?? 0.15}
                    className={FIELD_SHELL}
                  />
                </div>
                <div>
                  <label className={LABEL_UPPER} htmlFor="platform-min-obs">
                    Min observations
                  </label>
                  <input
                    id="platform-min-obs"
                    type="number"
                    name="minObservationCount"
                    defaultValue={settings?.minObservationCount ?? 3}
                    className={FIELD_SHELL}
                  />
                </div>
                <div>
                  <label className={LABEL_UPPER} htmlFor="platform-spike">
                    Behaviour spike %
                  </label>
                  <input
                    id="platform-spike"
                    type="number"
                    step="1"
                    name="behaviourSpikePercent"
                    defaultValue={settings?.behaviourSpikePercent ?? 50}
                    className={FIELD_SHELL}
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 21 17 13 7 13 7 21" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 3 7 8 15 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save settings
            </button>
          </div>
        </FormWithSuccessToast>
      </div>
    );
  }

  if (tab === "modules") {
    return (
      <div className={`overflow-hidden ${PLATFORM_CARD}`}>
        <div className="border-b border-border/20 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex gap-3 sm:gap-4">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(124,105,239,0.88)] text-white shadow-sm [&_svg]:shrink-0"
              aria-hidden
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path
                  d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.998.998 0 01-1.023.242 3 3 0 01-2.54-.298 3 3 0 01-2.54.298 1 1 0 01-1.023-.242L9.44 11.06a1 1 0 01-.242 1.023 3 3 0 01-.298 2.54 3 3 0 01.298 2.54 1 1 0 01.242 1.023l-1.611 1.611c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.568-1.568a1.019 1.019 0 01-.289-.878 3 3 0 01.298-2.54 3 3 0 01-.298-2.54 1 1 0 01.289-.878l1.568-1.568c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.611 1.611a1 1 0 011.023.242 3 3 0 012.54-.298 3 3 0 012.54.298 1 1 0 011.023-.242l1.611-1.611c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.568 1.568c.23.23.338.556.289.878a3 3 0 01-.298 2.54 3 3 0 01.298 2.54z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-text">Modules</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                Control which features are available across your school.
              </p>
            </div>
          </div>
        </div>
        <div className="grid auto-rows-fr gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
          {features.map((feature) => {
            const friendlyName = FEATURE_FRIENDLY_NAMES[feature.key] ?? feature.key;
            const { well, icon } = featureVisual(feature.key);
            return (
              <form key={feature.key} action={toggleFeature} className="flex min-h-[5.5rem]">
                <FormSuccessToast message={`${friendlyName} updated`} />
                <input type="hidden" name="key" value={feature.key} />
                <input type="hidden" name="enabled" value={String(feature.enabled)} />
                <button
                  type="submit"
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left calm-transition sm:p-5 ${
                    feature.enabled
                      ? "border-[var(--anx-card-border-strong)] bg-[var(--surface-container-lowest)] shadow-[var(--anx-elevated-shadow)] hover:shadow-[var(--anx-elevated-shadow-hover)]"
                      : "border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] bg-[var(--surface-container-low)]/40 shadow-[var(--anx-elevated-shadow)] hover:border-border hover:bg-[var(--surface-container-low)]/70"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:shrink-0 calm-transition group-hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${well}`}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold tracking-[-0.01em] ${feature.enabled ? "text-text" : "text-text/80"}`}>
                      {friendlyName}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {FEATURE_DESCRIPTIONS[feature.key] ?? "Controls access to this module."}
                    </p>
                  </div>
                  <span className="sr-only">{feature.enabled ? "On" : "Off"} — click to toggle</span>
                  <span
                    className={`relative mt-0.5 inline-block h-[26px] w-[46px] shrink-0 rounded-full transition-[background-color,box-shadow] duration-200 ${
                      feature.enabled
                        ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                        : "bg-[var(--surface-container-high)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]"
                    }`}
                    aria-hidden
                  >
                    <span
                      className={`absolute top-[4px] h-[18px] w-[18px] rounded-full shadow-md transition-transform duration-200 ease-out ${
                        feature.enabled
                          ? "translate-x-[22px] bg-[var(--surface-container-lowest)]"
                          : "translate-x-[4px] bg-[var(--surface-container-lowest)]"
                      }`}
                    />
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
