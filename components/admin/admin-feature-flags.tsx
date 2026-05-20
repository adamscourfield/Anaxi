"use client";

import type { ReactNode } from "react";
import { FormSuccessToast } from "@/components/form-success-toast";

const PLATFORM_CARD =
  "rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

const ICON_WELL_SCHOOL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#E0E7FF] text-[#4F46E5] shadow-none [&_svg]:shrink-0";

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

export function AdminFeatureFlags({
  features,
  toggleFeature,
}: {
  features: Array<{ key: string; enabled: boolean }>;
  toggleFeature: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className={`overflow-hidden ${PLATFORM_CARD}`}>
      <div className="border-b border-[#E5E7EB] px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex gap-3 sm:gap-4">
          <span className={ICON_WELL_SCHOOL} aria-hidden>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path
                d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.998.998 0 01-1.023.242 3 3 0 01-2.54-.298 3 3 0 01-2.54.298 1 1 0 01-1.023-.242L9.44 11.06a1 1 0 01-.242 1.023 3 3 0 01-.298 2.54 3 3 0 01.298 2.54 1 1 0 01.242 1.023l-1.611 1.611c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.568-1.568a1.019 1.019 0 01-.289-.878 3 3 0 01.298-2.54 3 3 0 01-.298-2.54 1 1 0 01.289-.878l1.568-1.568c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.611 1.611a1 1 0 011.023.242 3 3 0 012.54-.298 3 3 0 012.54.298 1 1 0 011.023-.242l1.611-1.611c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.568 1.568c.23.23.338.556.289.878a3 3 0 01-.298 2.54 3 3 0 01.298 2.54z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-[#111827]">Modules</h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
              Control which features are available across your school.
            </p>
          </div>
        </div>
      </div>
      <div className="grid auto-rows-fr gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
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
                    ? "border-[var(--anx-card-border-strong)] bg-[var(--surface-container-lowest)] shadow-none"
                    : "border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] bg-[var(--surface-container-low)]/40 shadow-none hover:border-border hover:bg-[var(--surface-container-low)]/70"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm [&_svg]:shrink-0 calm-transition ${well}`}
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
                  className={`relative mt-0.5 inline-block h-[26px] w-[46px] shrink-0 rounded-md transition-[background-color,box-shadow] duration-200 ${
                    feature.enabled
                      ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)]"
                      : "bg-[var(--surface-container-high)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]"
                  }`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-[4px] h-[18px] w-[18px] rounded-sm shadow-none transition-transform duration-200 ease-out ${
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
