export const LESSON_PHASE = {
  INSTRUCTION: "INSTRUCTION",
  GUIDED_PRACTICE: "GUIDED_PRACTICE",
  INDEPENDENT_PRACTICE: "INDEPENDENT_PRACTICE",
  UNKNOWN: "UNKNOWN",
} as const;

export type LessonPhase = (typeof LESSON_PHASE)[keyof typeof LESSON_PHASE];

export const SIGNAL_KEYS = {
  BEHAVIOUR_CLIMATE: "BEHAVIOUR_CLIMATE",
  PARTICIPATION_EQUITY: "PARTICIPATION_EQUITY",
  PACE_MOMENTUM: "PACE_MOMENTUM",
  COLD_CALL_DENSITY: "COLD_CALL_DENSITY",
  CFU_CYCLES: "CFU_CYCLES",
  ERROR_CORRECTION_DEPTH: "ERROR_CORRECTION_DEPTH",
  MODELLING_EXPLICITNESS: "MODELLING_EXPLICITNESS",
  LANGUAGE_PRECISION: "LANGUAGE_PRECISION",
  LIVE_ADJUSTMENT: "LIVE_ADJUSTMENT",
  RETRIEVAL_PRESENCE: "RETRIEVAL_PRESENCE",
  STRETCH_DEPLOYMENT: "STRETCH_DEPLOYMENT",
  INDEPENDENT_ACCOUNTABILITY: "INDEPENDENT_ACCOUNTABILITY",
} as const;

export type SignalKey = (typeof SIGNAL_KEYS)[keyof typeof SIGNAL_KEYS];

export type ScaleKey = "LIMITED" | "SOME" | "CONSISTENT" | "STRONG";

export type SignalDefinition = {
  key: SignalKey;
  order: number;
  displayNameDefault: string;
  descriptionDefault: string;
  phaseRelevance: LessonPhase[];
  isUniversal: boolean;

  scale: {
    key: ScaleKey;
    label: string;
    description: string; // global description
  }[];

  // NEW: per-signal calibration descriptions for each scale key
  scaleGuidance: Record<ScaleKey, string>;

  lookFors?: string[];
};

export const GLOBAL_SCALE: SignalDefinition["scale"] = [
  { key: "LIMITED", label: "Limited evidence", description: "Little evidence seen in the time observed." },
  { key: "SOME", label: "Some evidence", description: "Evident at points but not yet consistent." },
  { key: "CONSISTENT", label: "Consistent", description: "Routine and secure throughout what was observed." },
  { key: "STRONG", label: "Strong & embedded", description: "High-quality, purposeful and well embedded." },
];

export const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  {
    key: SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
    order: 1,
    displayNameDefault: "Behaviour & Focus",
    descriptionDefault:
      "Students are attentive, routines are secure, and learning time is protected. Transitions are calm and expectations are consistently reinforced.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Frequent disruption or off-task behaviour reduces learning time; routines not secure.",
      SOME: "Learning continues but with repeated interruptions; routines partly established but inconsistent.",
      CONSISTENT: "Routines are secure; behaviour issues are minor and dealt with quickly without derailing learning.",
      STRONG: "Climate is calm and purposeful; students self-regulate, transitions are crisp, and learning time is maximised.",
    },
    lookFors: [
      "Transitions are quick and orderly",
      "Corrections are calm, consistent, and immediate",
      "Low-level disruption does not derail learning time",
      "Students settle quickly and sustain attention",
    ],
  },
  {
    key: SIGNAL_KEYS.PARTICIPATION_EQUITY,
    order: 2,
    displayNameDefault: "Participation & Thinking Ratio",
    descriptionDefault:
      "A wide range of students are required to think and respond. Participation is not dominated by volunteers. Cold call is used deliberately.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Teacher mainly relies on volunteers; many students can remain passive.",
      SOME: "Some distribution beyond volunteers, but participation still uneven or predictable.",
      CONSISTENT: "Teacher regularly distributes questions so most students are accountable to think/respond.",
      STRONG: "Participation is broad and intentional; accountability is high and almost all students are drawn in.",
    },
    lookFors: [
      "Many students required to think (not just volunteers)",
      "Questions distributed across the room",
      "No long stretches where only a few students respond",
    ],
  },
  {
    key: SIGNAL_KEYS.PACE_MOMENTUM,
    order: 3,
    displayNameDefault: "Pace & Lesson Momentum",
    descriptionDefault:
      "The lesson moves forward with purpose. Transitions are efficient and students remain cognitively engaged.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Significant dead time or slow transitions; momentum frequently stalls.",
      SOME: "Generally moves forward but with noticeable slow periods or unclear task starts.",
      CONSISTENT: "Time is used well; transitions are efficient and students start tasks promptly.",
      STRONG: "Brisk, purposeful pacing; transitions are seamless and cognitive engagement remains high throughout.",
    },
    lookFors: ["Clear time expectations", "Fast transitions between tasks", "No extended dead time / waiting", "Students move quickly into work"],
  },
  {
    key: SIGNAL_KEYS.COLD_CALL_DENSITY,
    order: 4,
    displayNameDefault: "Cold Call & Directed Questioning",
    descriptionDefault:
      "Students are routinely and unpredictably asked to respond. Questioning checks understanding across the class, not just a few voices.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Cold call rarely/never used; questioning reaches only a small portion of the class.",
      SOME: "Cold call used occasionally, but not enough to create broad accountability.",
      CONSISTENT: "Cold call is used routinely to check understanding across the room.",
      STRONG: "High-frequency directed questioning; teacher samples widely and uses responses to steer teaching.",
    },
    lookFors: ["Cold call used routinely", "Teacher checks multiple students per concept", "Students expected to answer in full sentences where appropriate"],
  },
  {
    key: SIGNAL_KEYS.CFU_CYCLES,
    order: 5,
    displayNameDefault: "Checking for Understanding",
    descriptionDefault:
      "The teacher regularly checks for understanding before moving on and adapts instruction if misconceptions appear.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Teacher moves on without verifying understanding; misconceptions go unnoticed.",
      SOME: "Some checks occur but are infrequent, superficial, or don’t influence next steps.",
      CONSISTENT: "Regular checks before progression; teacher uses evidence to confirm readiness to move on.",
      STRONG: "Tight, frequent CFU loops; teaching adjusts immediately and precisely when misunderstanding appears.",
    },
    lookFors: ["Checks happen before moving to the next step", "Teacher uses checks to adapt instruction", "Misconceptions are surfaced early"],
  },
  {
    key: SIGNAL_KEYS.ERROR_CORRECTION_DEPTH,
    order: 6,
    displayNameDefault: "Error Correction & Feedback",
    descriptionDefault:
      "Misconceptions are addressed clearly and precisely. Students are required to correct and secure understanding.",
    phaseRelevance: [LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Errors are missed or corrected vaguely; students are not required to secure the correction.",
      SOME: "Errors are addressed but correction is inconsistent or doesn’t ensure students can now do it correctly.",
      CONSISTENT: "Teacher identifies specific errors and ensures students correct/re-attempt to secure understanding.",
      STRONG: "Misconceptions are anticipated and handled precisely; correction consistently leads to improved accuracy.",
    },
    lookFors: ["Teacher identifies the specific error (not just 'wrong')", "Correction is modelled or explained clearly", "Student re-attempts or articulates corrected understanding"],
  },
  {
    key: SIGNAL_KEYS.MODELLING_EXPLICITNESS,
    order: 7,
    displayNameDefault: "Explicit Modelling",
    descriptionDefault:
      "New knowledge or processes are clearly demonstrated. The thinking process is made visible before students practise independently.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Little/no modelling; students expected to attempt without a clear example or steps.",
      SOME: "Some modelling, but steps/thinking are not explicit or success criteria unclear.",
      CONSISTENT: "Clear modelling provided before practice; steps and expectations are explicit.",
      STRONG: "Modelling is exemplary: teacher narrates thinking, highlights common pitfalls, and links to success criteria.",
    },
    lookFors: ["Teacher demonstrates a worked example / exemplar", "Steps and decisions are explained explicitly", "Students know what success looks like before starting"],
  },
  {
    key: SIGNAL_KEYS.LANGUAGE_PRECISION,
    order: 8,
    displayNameDefault: "Language & Explanation Clarity",
    descriptionDefault:
      "Subject vocabulary is used accurately and explanations are clear, structured, and free from ambiguity.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Explanations are unclear or imprecise; key vocabulary is missing or used inaccurately.",
      SOME: "Generally clear but with occasional ambiguity; vocabulary not consistently reinforced.",
      CONSISTENT: "Clear, structured explanations; accurate subject vocabulary used and expected from students.",
      STRONG: "Highly precise explanations; vocabulary is embedded, defined well, and consistently demanded in student responses.",
    },
    lookFors: ["Key terms defined and used accurately", "Explanations are step-by-step", "Students required to use correct vocabulary"],
  },
  {
    key: SIGNAL_KEYS.LIVE_ADJUSTMENT,
    order: 9,
    displayNameDefault: "Responsive Teaching",
    descriptionDefault:
      "Instruction adjusts in response to student understanding. The teacher slows down, re-explains, or extends as needed.",
    phaseRelevance: [LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Teaching continues as planned regardless of student understanding; misunderstandings persist.",
      SOME: "Some adjustment occurs, but it’s delayed or not clearly based on evidence from students.",
      CONSISTENT: "Teacher adapts in response to checks (re-explains, re-models, or extends appropriately).",
      STRONG: "Adjustment is rapid and precise; teacher uses live evidence to optimise pace and understanding continuously.",
    },
    lookFors: ["Teacher changes approach based on student responses", "Misunderstanding triggers reteach or re-model", "Teacher extends where understanding is secure"],
  },
  {
    key: SIGNAL_KEYS.RETRIEVAL_PRESENCE,
    order: 10,
    displayNameDefault: "Retrieval & Recall",
    descriptionDefault:
      "Students are required to recall previously taught material. Retrieval strengthens long-term memory and connects prior learning.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "No retrieval of prior learning is evident; lesson starts without recall or connection to prior knowledge.",
      SOME: "Retrieval happens briefly or inconsistently; limited checking of what students actually recall.",
      CONSISTENT: "Retrieval is routine (e.g., Do Now) and teacher checks recall to inform teaching.",
      STRONG: "Retrieval is purposeful and well checked; prior knowledge is connected explicitly to new learning.",
    },
    lookFors: ["Do Now / retrieval task is used", "Prior learning is revisited explicitly", "Teacher checks recall (not just sets questions)"],
  },
  {
    key: SIGNAL_KEYS.STRETCH_DEPLOYMENT,
    order: 11,
    displayNameDefault: "Stretch & Challenge",
    descriptionDefault:
      "Students are pushed to deepen thinking, extend answers, and apply knowledge beyond surface-level responses.",
    phaseRelevance: [LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Tasks/questions remain surface-level; little pressing for depth or application.",
      SOME: "Some challenge is present but inconsistent or only for a small subset of students.",
      CONSISTENT: "Teacher regularly pushes for depth (why/how), application, and higher-quality responses.",
      STRONG: "Stretch is systematic: most students are pushed, scaffolds are used well, and challenge raises thinking without losing clarity.",
    },
    lookFors: ["Teacher presses for 'why' / 'how' not just 'what'", "Students required to justify or apply", "Tasks/questions increase in sophistication"],
  },
  {
    key: SIGNAL_KEYS.INDEPENDENT_ACCOUNTABILITY,
    order: 12,
    displayNameDefault: "Independent Practice & Accountability",
    descriptionDefault:
      "Students practise independently with clear expectations. Work is monitored and misconceptions are identified promptly.",
    phaseRelevance: [LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Independent work lacks clear expectations; limited monitoring; low completion or low accuracy goes unchecked.",
      SOME: "Expectations exist but accountability/monitoring is uneven; some students drift or misconceptions persist.",
      CONSISTENT: "Clear expectations and active monitoring; students are held accountable for completion and accuracy.",
      STRONG: "High accountability: teacher circulation is purposeful, feedback is timely, and almost all students produce high-quality practice.",
    },
    lookFors: ["Clear expectations for quality and quantity of work", "Teacher actively circulates and checks work", "Students held accountable for completion and accuracy"],
  },
];
