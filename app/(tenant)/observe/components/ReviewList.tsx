"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import type { SignalDefinition } from "@/modules/observations/signalTypes";
import { loadDraft, persistDraft } from "./observationDraft";
import { ReviewStageChrome } from "./ReviewStageChrome";
import {
  OBS_REVIEW_MUTED,
  OBS_REVIEW_TEXT,
  ObservationReviewSectionHeader,
  ObservationReviewSessionCard,
  ObservationReviewTeacherCard,
} from "./observationReviewUi";

type LabelMap = Record<string, { displayName: string; description?: string }>;

const SCALE_DISPLAY: Record<string, { label: string; dot: string }> = {
  LIMITED: { label: "Limited", dot: "bg-[#F59E0B]" },
  SOME: { label: "Some", dot: "bg-[#F59E0B]" },
  CONSISTENT: { label: "Consistent", dot: "bg-emerald-500" },
  STRONG: { label: "Strong", dot: "bg-emerald-500" },
};

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

export function ReviewList({
  draftKey,
  signals,
  labelMap,
  action,
  schoolType,
  teachers,
  priorCountByTeacherId,
  observerFullName,
}: {
  draftKey: string;
  signals: SignalDefinition[];
  labelMap: LabelMap;
  action: (formData: FormData) => void;
  schoolType: TenantSchoolType;
  teachers: { id: string; fullName: string; role: string }[];
  priorCountByTeacherId: Record<string, number>;
  observerFullName: string;
}) {
  const router = useRouter();
  const allSignals = useMemo(() => [...signals].sort((a, b) => a.order - b.order), [signals]);
  const [draft, setDraft] = useState(() => loadDraft(draftKey, allSignals.map((s) => s.key)));
  const orderedSignals = useMemo(
    () => getSignalsForPhase(draft.context.phase, schoolType),
    [draft.context.phase, schoolType],
  );

  const completed = orderedSignals.filter((s) => {
    const st = draft.signalState[s.key];
    return st?.valueKey || st?.notObserved;
  }).length;

  const rated = orderedSignals.filter((s) => draft.signalState[s.key]?.valueKey).length;
  const skipped = orderedSignals.filter((s) => draft.signalState[s.key]?.notObserved && !draft.signalState[s.key]?.valueKey).length;
  const allDone = completed === orderedSignals.length;
  const remaining = orderedSignals.length - completed;

  const yearLabel = draft.context.yearGroup
    ? draft.context.yearGroup.replace(/^Y(\d+)$/i, "Year $1")
    : draft.context.classCode;
  const classLine = [yearLabel, draft.context.subject].filter(Boolean).join(" ");

  const teacher = teachers.find((t) => t.id === draft.context.teacherId);
  const teacherName = teacher?.fullName ?? "Select a teacher";
  const roleLabel = teacher ? formatRole(teacher.role) : "—";
  const priorTotal = draft.context.teacherId ? (priorCountByTeacherId[draft.context.teacherId] ?? 0) : 0;
  const tenureLabel =
    !draft.context.teacherId || priorTotal === 0
      ? draft.context.teacherId
        ? "First observation on record"
        : "—"
      : `${priorTotal} prior observation${priorTotal === 1 ? "" : "s"}`;

  const observedDateLabel =
    draft.context.observedAt &&
    new Date(draft.context.observedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const capIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
  const calendarIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
  const userIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
  const bookIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
  const chartIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 16l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <ReviewStageChrome>
      <div className="relative -mx-4 min-h-0 bg-[#F9FAFB] px-4 pb-14 pt-1 sm:-mx-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h2 className={`text-[1.375rem] font-bold ${OBS_REVIEW_TEXT}`}>Review &amp; Submit</h2>
            <p className={`mt-2 max-w-2xl text-[0.875rem] leading-relaxed ${OBS_REVIEW_MUTED}`}>
              Verify captured signals and add concluding reflections before finalizing this session.
            </p>
          </div>

          <form action={action}>
            <input type="hidden" name="observedTeacherId" value={draft.context.teacherId} />
            <input type="hidden" name="yearGroup" value={draft.context.yearGroup || draft.context.classCode} />
            <input type="hidden" name="subject" value={draft.context.subject} />
            <input type="hidden" name="phase" value={draft.context.phase} />
            <input type="hidden" name="classCode" value={draft.context.classCode} />
            <input type="hidden" name="observedAt" value={draft.context.observedAt} />

            {orderedSignals.map((signal) => {
              const state = draft.signalState[signal.key];
              return (
                <span key={signal.key}>
                  <input type="hidden" name={`signal_${signal.key}_value`} value={state?.valueKey || ""} />
                  <input type="hidden" name={`signal_${signal.key}_not`} value={state?.notObserved ? "1" : ""} />
                </span>
              );
            })}

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-12">
              <div className="min-w-0 space-y-8">
                <div>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 [&_svg]:h-[18px] [&_svg]:w-[18px]"
                        aria-hidden
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M3 3v18h18" strokeLinecap="round" />
                          <path d="M7 16l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <h3 className={`text-[0.9375rem] font-semibold tracking-tight ${OBS_REVIEW_TEXT}`}>Signal Summary</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/observe/new/signals")}
                      className={`inline-flex items-center gap-1.5 rounded-full border border-[#D1D5DB] bg-white px-3 py-1.5 text-[0.8125rem] font-medium ${OBS_REVIEW_MUTED} shadow-sm transition-colors hover:border-[#9CA3AF] hover:text-[#111827]`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit observations
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {orderedSignals.map((signal, index) => {
                      const state = draft.signalState[signal.key];
                      const displayName = labelMap[signal.key]?.displayName || signal.displayNameDefault;
                      const scaleKey = state?.valueKey;
                      const display = scaleKey ? SCALE_DISPLAY[scaleKey] : null;
                      const isSkipped = state?.notObserved && !state?.valueKey;

                      const statusIcon = display ? (
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${display.dot}`}>
                          <span className="h-2 w-2 rounded-full bg-white/90" aria-hidden />
                        </span>
                      ) : isSkipped ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9CA3AF] text-white">
                          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
                            <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#D1D5DB] bg-[#F3F4F6]" aria-hidden />
                      );

                      return (
                        <button
                          key={signal.key}
                          type="button"
                          onClick={() => router.push(`/observe/new/signals?index=${index}`)}
                          className="flex w-full items-center gap-3 rounded-[999px] bg-[#E5E7EB]/90 px-5 py-3.5 text-left transition-colors hover:bg-[#E5E7EB]"
                        >
                          {statusIcon}
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[0.875rem] font-medium ${OBS_REVIEW_TEXT}`}>{displayName}</span>
                            <span className={`mt-0.5 block text-[0.75rem] ${OBS_REVIEW_MUTED}`}>
                              {display ? display.label : isSkipped ? "Skipped" : "Pending"}
                            </span>
                          </span>
                          <svg
                            className="h-4 w-4 shrink-0 text-[#9CA3AF]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden
                          >
                            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-[999px] border border-amber-200 bg-amber-50 px-5 py-3.5 text-[0.8125rem] leading-relaxed text-amber-900">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[0.625rem] font-bold text-amber-900"
                    aria-hidden
                  >
                    i
                  </span>
                  <p>
                    Once submitted, this observation will be locked for 24 hours while the Ledger processes the institutional
                    confidence score. You may request a correction link via support if required.
                  </p>
                </div>
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
                    {
                      label: "Date",
                      value: observedDateLabel || "—",
                      icon: calendarIcon,
                    },
                    { label: "Observer", value: observerFullName, icon: userIcon },
                    {
                      label: "Signals",
                      icon: chartIcon,
                      value: `${rated} rated${skipped > 0 ? `, ${skipped} skipped` : ""}`,
                    },
                    {
                      label: "Status",
                      accent: true,
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 3" strokeLinecap="round" />
                        </svg>
                      ),
                      value: (
                        <span className="flex items-center gap-2 font-bold uppercase tracking-wide">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden />
                          Draft
                        </span>
                      ),
                    },
                  ]}
                />

                <div>
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
                    title="Concluding notes"
                  />
                  <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
                    <textarea
                      name="contextNote"
                      className="field min-h-[140px] w-full resize-y border-0 bg-transparent px-5 py-4 text-[0.875rem] text-[#111827] shadow-none placeholder:text-[#9CA3AF] focus-visible:ring-0"
                      placeholder="Final reflections on this session — strengths and areas for development…"
                      rows={5}
                      value={draft.context.contextNote}
                      onChange={(e) => {
                        const next = { ...draft, context: { ...draft.context, contextNote: e.target.value } };
                        setDraft(next);
                        persistDraft(draftKey, next);
                      }}
                    />
                    <div className="flex justify-end border-t border-[#F3F4F6] px-5 py-3">
                      <span className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                        Required
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={!allDone}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F2937] px-6 py-3.5 text-[0.875rem] font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                    Submit observation
                  </button>

                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D1D5DB] bg-white px-6 py-3.5 text-[0.875rem] font-medium text-[#111827] shadow-sm transition-colors hover:bg-[#F9FAFB]"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back to signals
                  </button>
                </div>

                {!allDone && (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <svg className="h-4 w-4 shrink-0 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <p className="text-[0.8125rem] text-amber-900">
                      {remaining} signal{remaining !== 1 ? "s" : ""} still need a rating or skip.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </form>
        </div>
      </div>
    </ReviewStageChrome>
  );
}
