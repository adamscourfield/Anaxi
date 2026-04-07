import type { SignalKey } from "@prisma/client";

export type { SignalKey };

export const LESSON_PHASE = {
  INSTRUCTION: "INSTRUCTION",
  GUIDED_PRACTICE: "GUIDED_PRACTICE",
  INDEPENDENT_PRACTICE: "INDEPENDENT_PRACTICE",
  UNKNOWN: "UNKNOWN",
  THRESHOLD: "THRESHOLD",
  /** Primary-only: start of lesson / transition in (replaces THRESHOLD for primary routing). */
  TRANSITION_START: "TRANSITION_START",
  BOOKS: "BOOKS",
} as const;

export type LessonPhase = (typeof LESSON_PHASE)[keyof typeof LESSON_PHASE];

/** Secondary classroom phases (non-book). */
export const CLASSROOM_LESSON_PHASES_SECONDARY: LessonPhase[] = [
  LESSON_PHASE.THRESHOLD,
  LESSON_PHASE.INSTRUCTION,
  LESSON_PHASE.GUIDED_PRACTICE,
  LESSON_PHASE.INDEPENDENT_PRACTICE,
];

/** Primary classroom phases (non-book). */
export const CLASSROOM_LESSON_PHASES_PRIMARY: LessonPhase[] = [
  LESSON_PHASE.TRANSITION_START,
  LESSON_PHASE.INSTRUCTION,
  LESSON_PHASE.GUIDED_PRACTICE,
  LESSON_PHASE.INDEPENDENT_PRACTICE,
];

export type ScaleKey = "LIMITED" | "SOME" | "CONSISTENT" | "STRONG";

export type SignalDefinition = {
  key: SignalKey;
  order: number;
  displayNameDefault: string;
  descriptionDefault: string;
  /** Lesson phase this signal belongs to. Empty when `isUniversal` (classroom-wide). Book signals use `BOOKS` only. */
  phases: LessonPhase[];
  isUniversal: boolean;

  scale: {
    key: ScaleKey;
    label: string;
    description: string;
  }[];

  scaleGuidance: Record<ScaleKey, string>;

  lookFors?: string[];

  /** Legacy keys kept for DB/back-compat; excluded from classroom capture (UNKNOWN) and explorer. */
  deprecated?: boolean;
};

export const GLOBAL_SCALE: SignalDefinition["scale"] = [
  { key: "LIMITED", label: "Limited evidence", description: "Little evidence seen in the time observed." },
  { key: "SOME", label: "Some evidence", description: "Evident at points but not yet consistent." },
  { key: "CONSISTENT", label: "Consistent", description: "Routine and secure throughout what was observed." },
  { key: "STRONG", label: "Strong & embedded", description: "High-quality, purposeful and well embedded." },
];

export const BOOKS_SCALE: SignalDefinition["scale"] = [
  { key: "LIMITED", label: "Limited", description: "Standard is poor across the majority of books reviewed." },
  { key: "SOME", label: "Some", description: "Inconsistent across books." },
  { key: "CONSISTENT", label: "Consistent", description: "Broadly consistent across the books reviewed." },
  { key: "STRONG", label: "Strong", description: "Standards are uniform and a source of visible pride." },
];
