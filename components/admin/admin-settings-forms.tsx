"use client";

import { FormWithSuccessToast } from "@/components/form-success-toast";
import { AdminFeatureFlags } from "@/components/admin/admin-feature-flags";

/** Platform settings — match product mock (soft cards, #E5E7EB fields, navy primary) */
const PLATFORM_CARD =
  "rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

const FIELD_SHELL =
  "w-full rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#CBD5E1] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]";

const LABEL_UPPER =
  "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]";

const ICON_WELL_SCHOOL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#E0E7FF] text-[#4F46E5] shadow-none [&_svg]:shrink-0";

type SchoolSettings = {
  schoolName: string | null;
  timezone: string | null;
  defaultInsightWindowDays: number | null;
  driftDeltaThreshold: number | null;
  minObservationCount: number | null;
  behaviourSpikePercent: number | null;
};

type AdminSettingsFormsProps =
  | { tab: "school"; settings: SchoolSettings | null; saveSettings: (formData: FormData) => Promise<void> }
  | {
      tab: "modules";
      features: Array<{ key: string; enabled: boolean }>;
      toggleFeature: (formData: FormData) => Promise<void>;
    };

export function AdminSettingsForms(props: AdminSettingsFormsProps) {
  if (props.tab === "school") {
    const { settings, saveSettings } = props;
    return (
      <div className={`overflow-hidden ${PLATFORM_CARD}`}>
        <div className="border-b border-[#E5E7EB] px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex gap-3 sm:gap-4">
            <span className={ICON_WELL_SCHOOL} aria-hidden>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 21h16M6 21V10l6-4 6 4v11M10 21v-6h4v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-[#111827]">School details</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
                Set the school name, timezone, and default insight window.
              </p>
            </div>
          </div>
        </div>
        <FormWithSuccessToast
          action={saveSettings}
          successMessage="Settings saved"
          className="space-y-5 px-6 py-7 sm:space-y-6 sm:px-8 sm:pb-8"
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

          <details className="group max-w-3xl rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 calm-transition hover:bg-[#F9FAFB] [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 21v-7M4 10V8a2 2 0 012-2h6a2 2 0 012 2v2M4 21h16M8 21v-9M12 21v-5M16 21v-3M20 10v11" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 8h1M11 8h1M15 8h1" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 text-[0.9375rem] font-bold text-[#111827]">Advanced thresholds</span>
              <svg
                className="h-5 w-5 shrink-0 text-[#9CA3AF] calm-transition group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="border-t border-[#E5E7EB] px-4 py-5">
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
              className="inline-flex items-center gap-2 rounded-sm bg-[var(--on-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--surface-container-lowest)] shadow-none calm-transition hover:bg-[var(--on-surface)]/90"
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

  return <AdminFeatureFlags features={props.features} toggleFeature={props.toggleFeature} />;
}
