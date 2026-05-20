import type { SignalDefinition } from "@/modules/observations/signalTypes";
import type { TenantSignalLabelMap } from "@/modules/observations/tenantSignalLabels";
import { SignalKeyIcon } from "./SignalKeyIcon";

const TH =
  "px-4 py-3.5 text-left text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280] sm:px-5";
const ROW_BORDER = "border-b border-[rgba(15,23,42,0.06)]";

function InfoCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  signalCatalog: SignalDefinition[];
  labels: TenantSignalLabelMap;
  saveAll: (formData: FormData) => Promise<void>;
  resetOne: (formData: FormData) => Promise<void>;
  resetAll: (formData?: FormData) => Promise<void>;
  /** When true, show a bottom bar with primary Save (e.g. standalone /admin/signals). When false, caller supplies save (e.g. wrapped in Terminology page). */
  showFooterSave?: boolean;
  footerSaveLabel?: string;
};

export function ObservationSignalLabelsSection({
  signalCatalog,
  labels,
  saveAll,
  resetOne,
  resetAll,
  showFooterSave = true,
  footerSaveLabel = "Save changes",
}: Props) {
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none">
      <div
        className={`flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7 sm:py-6 ${ROW_BORDER}`}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-[#111827]">Observation signal labels</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
            Adjust display names and descriptions used in observation screens.
          </p>
        </div>
        <form action={resetAll} className="shrink-0">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-[0.8125rem] font-semibold text-[#111827] shadow-sm calm-transition hover:bg-[#F9FAFB] sm:w-auto"
          >
            <ResetArrowIcon className="h-4 w-4 shrink-0 text-[#7C5CFF]" />
            Bulk reset
          </button>
        </form>
      </div>

      <form action={saveAll} className="block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[0.8125rem]">
            <thead>
              <tr className={ROW_BORDER}>
                <th className={`${TH} w-[220px]`}>Signal</th>
                <th className={`${TH} min-w-[140px]`}>Default name</th>
                <th className={`${TH} min-w-[160px]`}>
                  <span className="inline-flex items-center gap-1.5">
                    Display name
                    <span className="text-[#7C5CFF]" title="Shown in observation UI">
                      <InfoCircleIcon className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </th>
                <th className={`${TH} min-w-[240px]`}>Description</th>
                <th className={`${TH} w-[120px] text-right sm:pr-6`}>Reset</th>
              </tr>
            </thead>
            <tbody>
              {signalCatalog.map((signal) => {
                const override = labels[signal.key];
                return (
                  <tr
                    key={signal.key}
                    className={`group calm-transition hover:bg-[var(--surface-container-low)]/60 ${ROW_BORDER} last:border-b-0`}
                  >
                    <td className="px-4 py-4 align-top sm:px-5">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(124,92,255,0.1)]">
                          <SignalKeyIcon signalKey={signal.key} />
                        </span>
                        <span className="break-all pt-1.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-text">
                          {signal.key}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-[#6B7280] sm:px-5">
                      <span className="leading-snug">{signal.displayNameDefault}</span>
                    </td>
                    <td className="px-4 py-4 align-top sm:px-5">
                      <input
                        name={`display_${signal.key}`}
                        defaultValue={override?.displayName || signal.displayNameDefault}
                        minLength={2}
                        maxLength={80}
                        required
                        className="field w-full min-h-[2.5rem] rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3.5 py-2 text-[0.8125rem] text-[#111827] outline-none transition focus:border-[#CBD5E1] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                      />
                    </td>
                    <td className="px-4 py-4 align-top sm:px-5">
                      <textarea
                        name={`description_${signal.key}`}
                        defaultValue={override?.description ?? signal.descriptionDefault}
                        maxLength={240}
                        rows={3}
                        className="field min-h-[5.5rem] w-full resize-y rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-[#111827] outline-none transition focus:border-[#CBD5E1] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                      />
                    </td>
                    <td className="px-4 py-4 align-top text-right sm:px-6">
                      <button
                        type="submit"
                        formAction={resetOne}
                        name="signalKey"
                        value={signal.key}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-2.5 py-1.5 text-[0.8125rem] font-semibold text-[#7C5CFF] shadow-sm calm-transition hover:bg-[#F9FAFB]"
                      >
                        <ResetArrowIcon className="h-4 w-4 shrink-0" />
                        Reset
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showFooterSave ? (
          <div className={`flex justify-end border-t border-[rgba(15,23,42,0.06)] px-5 py-4 sm:px-7`}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-neutral-950 px-6 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-neutral-900"
            >
              {footerSaveLabel}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
