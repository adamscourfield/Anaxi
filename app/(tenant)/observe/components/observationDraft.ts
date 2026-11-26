"use client";

export type Phase =
  | "INSTRUCTION"
  | "GUIDED_PRACTICE"
  | "INDEPENDENT_PRACTICE"
  | "UNKNOWN"
  | "THRESHOLD"
  | "TRANSITION_START"
  | "BOOKS";
export type ScaleKey = "LIMITED" | "SOME" | "CONSISTENT" | "STRONG";

export type ObservationContextState = {
  teacherId: string;
  department: string;
  classCode: string;
  observedAt: string;
  phase: Phase;
  yearGroup: string;
  subject: string;
  contextNote: string;
};

export type SignalEntry = { valueKey: ScaleKey | null; notObserved: boolean };

export type ObservationDraft = {
  context: ObservationContextState;
  signalState: Record<string, SignalEntry>;
};

/** Today's date (YYYY-MM-DD) in UK time, worked out when called rather than at module load. */
export function todayInSchoolZone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Year groups offered on the form, stored as "Y7" ("R" for Reception), as everywhere else (lib/yearGroup). */
export function yearGroupOptions(schoolType: "PRIMARY" | "SECONDARY"): { value: string; label: string }[] {
  if (schoolType === "PRIMARY") {
    return [
      { value: "R", label: "Reception" },
      ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: `Y${n}`, label: `Year ${n}` })),
    ];
  }
  return [7, 8, 9, 10, 11, 12, 13].map((n) => ({ value: `Y${n}`, label: `Year ${n}` }));
}

/**
 * Guess the year group from what the observer typed as the class, e.g.
 * "10A/Ma1", "Year 9 set 2", "Y8 French". Returns "" when there is no clear year.
 */
export function guessYearGroup(classCode: string, schoolType: "PRIMARY" | "SECONDARY"): string {
  const text = classCode.trim();
  if (!text) return "";
  if (/^(?:rec|reception)\b/i.test(text)) return schoolType === "PRIMARY" ? "R" : "";
  const match = text.match(/\b(?:year|yr|y)\s*(\d{1,2})(?!\d)/i) || text.match(/^(\d{1,2})(?=[^\d]|$)/);
  if (!match) return "";
  const value = `Y${Number(match[1])}`;
  return yearGroupOptions(schoolType).some((o) => o.value === value) ? value : "";
}

export const DEFAULT_CONTEXT: ObservationContextState = {
  teacherId: "",
  department: "",
  classCode: "",
  observedAt: "",
  phase: "UNKNOWN",
  yearGroup: "",
  subject: "",
  contextNote: "",
};

export const emptyDraft = (signalKeys: string[]): ObservationDraft => ({
  context: { ...DEFAULT_CONTEXT, observedAt: typeof window === "undefined" ? "" : todayInSchoolZone() },
  signalState: Object.fromEntries(signalKeys.map((key) => [key, { valueKey: null, notObserved: false }]))
});

export function loadDraft(draftKey: string, signalKeys: string[]) {
  if (typeof window === "undefined") return emptyDraft(signalKeys);
  try {
    const raw = window.sessionStorage.getItem(draftKey);
    if (!raw) return emptyDraft(signalKeys);
    const parsed = JSON.parse(raw) as ObservationDraft;
    const next = emptyDraft(signalKeys);
    return {
      context: { ...next.context, ...(parsed.context || {}) },
      signalState: { ...next.signalState, ...(parsed.signalState || {}) }
    };
  } catch {
    return emptyDraft(signalKeys);
  }
}

export function persistDraft(draftKey: string, draft: ObservationDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {
    // Private browsing or a full store: the flow still works for this page.
  }
}

export function clearDraft(draftKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(draftKey);
  } catch {
    // Nothing to clear.
  }
}
