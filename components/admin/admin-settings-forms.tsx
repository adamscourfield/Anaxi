"use client";

import type { ReactNode } from "react";
import { FormWithSuccessToast, FormSuccessToast } from "@/components/form-success-toast";
import { Button } from "@/components/ui/button";

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
      <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.06)] sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">School details</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">Set the school name, timezone, and default insight window.</p>
        </div>
        <FormWithSuccessToast
          action={saveSettings}
          successMessage="Settings saved"
          className="space-y-4"
        >
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">School name</label>
              <input
                name="schoolName"
                defaultValue={settings?.schoolName ?? ""}
                placeholder="My School"
                className="field rounded-xl border-border/60 bg-[var(--surface-container-low)]/80"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Timezone</label>
              <select
                name="timezone"
                defaultValue={settings?.timezone ?? "Europe/London"}
                className="field rounded-xl border-border/60 bg-[var(--surface-container-low)]/80"
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
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Default insight window</label>
              <select
                name="defaultInsightWindowDays"
                defaultValue={String(settings?.defaultInsightWindowDays ?? 21)}
                className="field rounded-xl border-border/60 bg-[var(--surface-container-low)]/80"
              >
                <option value="7">7 days</option>
                <option value="21">21 days</option>
                <option value="28">28 days</option>
              </select>
            </div>
          </div>

          <details className="rounded-xl border border-border/60 bg-[var(--surface-container-low)]/50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-text">Advanced thresholds</summary>
            <div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Drift delta</label>
                <input
                  type="number"
                  step="0.01"
                  name="driftDeltaThreshold"
                  defaultValue={settings?.driftDeltaThreshold ?? 0.15}
                  className="field rounded-xl border-border/60 bg-[var(--surface-container-lowest)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Min observations</label>
                <input
                  type="number"
                  name="minObservationCount"
                  defaultValue={settings?.minObservationCount ?? 3}
                  className="field rounded-xl border-border/60 bg-[var(--surface-container-lowest)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Behaviour spike %</label>
                <input
                  type="number"
                  step="1"
                  name="behaviourSpikePercent"
                  defaultValue={settings?.behaviourSpikePercent ?? 50}
                  className="field rounded-xl border-border/60 bg-[var(--surface-container-lowest)]"
                />
              </div>
            </div>
          </details>

          <Button type="submit" className="rounded-full px-6">
            Save settings
          </Button>
        </FormWithSuccessToast>
      </div>
    );
  }

  if (tab === "modules") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">Modules</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">Control which features are available across your school.</p>
        </div>
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] calm-transition sm:p-5 ${
                    feature.enabled
                      ? "border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[var(--surface-container-lowest)] hover:border-[color-mix(in_srgb,var(--primary)_18%,var(--outline-variant))] hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)]"
                      : "border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] bg-[var(--surface-container-low)]/40 hover:border-border hover:bg-[var(--surface-container-low)]/70"
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
