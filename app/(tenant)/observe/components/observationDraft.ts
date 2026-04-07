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

export const DEFAULT_CONTEXT: ObservationContextState = {
  teacherId: "",
  department: "",
  classCode: "",
  observedAt: new Date().toISOString().split("T")[0],
  phase: "UNKNOWN",
  yearGroup: "",
  subject: "",
  contextNote: "",
};

export const emptyDraft = (signalKeys: string[]): ObservationDraft => ({
  context: DEFAULT_CONTEXT,
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
  window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
}

export function clearDraft(draftKey: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(draftKey);
}
