export const LESSON_PHASE = {
  INSTRUCTION: "INSTRUCTION",
  GUIDED_PRACTICE: "GUIDED_PRACTICE",
  INDEPENDENT_PRACTICE: "INDEPENDENT_PRACTICE",
  UNKNOWN: "UNKNOWN",
  THRESHOLD: "THRESHOLD",
  BOOKS: "BOOKS",
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
  PRESENTATION_STANDARD: "PRESENTATION_STANDARD",
  WORK_COMPLETION: "WORK_COMPLETION",
  SUSTAINED_EFFORT: "SUSTAINED_EFFORT",
  TASK_APPROPRIATENESS: "TASK_APPROPRIATENESS",
  VOLUME_OF_WORK: "VOLUME_OF_WORK",
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

export const BOOKS_SCALE: SignalDefinition["scale"] = [
  { key: "LIMITED", label: "Limited", description: "Standard is poor across the majority of books reviewed." },
  { key: "SOME", label: "Some", description: "Inconsistent across books." },
  { key: "CONSISTENT", label: "Consistent", description: "Broadly consistent across the books reviewed." },
  { key: "STRONG", label: "Strong", description: "Standards are uniform and a source of visible pride." },
];

export const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  {
    key: SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
    order: 1,
    displayNameDefault: "Behaviour & Focus",
    descriptionDefault:
      "Students are attentive, routines are secure, and learning time is protected. Transitions are calm and expectations are consistently reinforced.",
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INSTRUCTION, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
    phaseRelevance: [LESSON_PHASE.INDEPENDENT_PRACTICE, LESSON_PHASE.GUIDED_PRACTICE, LESSON_PHASE.UNKNOWN, LESSON_PHASE.THRESHOLD],
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
  {
    key: SIGNAL_KEYS.PRESENTATION_STANDARD,
    order: 13,
    displayNameDefault: "Presentation Standard",
    descriptionDefault: "Work is neat, organised, and reflects pride in output.",
    phaseRelevance: [LESSON_PHASE.BOOKS],
    isUniversal: false,
    scale: BOOKS_SCALE,
    scaleGuidance: {
      LIMITED: "Presentation is poor across most books; work is frequently illegible, untitled, or defaced.",
      SOME: "Presentation is inconsistent; some books show care but others fall below a basic standard.",
      CONSISTENT: "Work is consistently tidy and organised; pages are dated, titled, and legible across the set.",
      STRONG: "Presentation is a source of visible pride; standards are uniform across books with no deterioration over time.",
    },
    lookFors: [
      "Handwriting is legible",
      "Pages are dated and titled",
      "No graffiti or defacement",
      "Work is not scrawled or rushed",
    ],
  },
  {
    key: SIGNAL_KEYS.WORK_COMPLETION,
    order: 14,
    displayNameDefault: "Work Completion",
    descriptionDefault: "Tasks are finished to the expected level with no unexplained gaps.",
    phaseRelevance: [LESSON_PHASE.BOOKS],
    isUniversal: false,
    scale: BOOKS_SCALE,
    scaleGuidance: {
      LIMITED: "Significant gaps and incomplete tasks are the norm; little evidence that completion is expected or enforced.",
      SOME: "Some tasks are finished but gaps are frequent and unexplained; completion is not yet consistent.",
      CONSISTENT: "The majority of tasks are complete; gaps are minor and always explainable.",
      STRONG: "Every task is completed to the expected standard; gaps are rare and consistently explained.",
    },
    lookFors: [
      "No half-finished tasks",
      "No blank pages where work was expected",
      "Incomplete work has a visible reason",
    ],
  },
  {
    key: SIGNAL_KEYS.SUSTAINED_EFFORT,
    order: 15,
    displayNameDefault: "Sustained Effort",
    descriptionDefault: "Work quality is consistent across the book, not just in isolated entries.",
    phaseRelevance: [LESSON_PHASE.BOOKS],
    isUniversal: false,
    scale: BOOKS_SCALE,
    scaleGuidance: {
      LIMITED: "Effort varies significantly across the book; clear evidence of coasting or declining standards over time.",
      SOME: "Strong patches exist but effort is not sustained across the full book; quality deteriorates over time.",
      CONSISTENT: "Work quality is broadly consistent across the book; no significant deterioration in effort or output.",
      STRONG: "Standards are sustained or improve over time; no evidence of effort being rationed across the year.",
    },
    lookFors: [
      "Quality does not visibly decline over weeks",
      "Effort in early pages matches effort in recent pages",
      "No evidence of coasting",
    ],
  },
  {
    key: SIGNAL_KEYS.TASK_APPROPRIATENESS,
    order: 16,
    displayNameDefault: "Task Appropriateness",
    descriptionDefault: "Written tasks reflect the curriculum intent for that year group and subject.",
    phaseRelevance: [LESSON_PHASE.BOOKS],
    isUniversal: false,
    scale: BOOKS_SCALE,
    scaleGuidance: {
      LIMITED: "Tasks are frequently trivial or generic; work is disconnected from the subject's disciplinary demands.",
      SOME: "Some tasks are appropriate but others are low-demand or repetitive; curriculum intent is not consistently evident.",
      CONSISTENT: "Tasks are clearly subject-relevant and age-appropriate; curriculum planning is coherent and evident.",
      STRONG: "Tasks are ambitious and disciplinarily authentic; clearly connected to a coherent and well-sequenced curriculum.",
    },
    lookFors: [
      "Tasks are not trivial or generic",
      "Work reflects the subject's disciplinary demands",
      "Tasks require thinking, not just copying",
    ],
  },
  {
    key: SIGNAL_KEYS.VOLUME_OF_WORK,
    order: 17,
    displayNameDefault: "Volume of Work",
    descriptionDefault: "Quantity of written work is appropriate given time elapsed and subject demands.",
    phaseRelevance: [LESSON_PHASE.BOOKS],
    isUniversal: false,
    scale: BOOKS_SCALE,
    scaleGuidance: {
      LIMITED: "The book is sparse; volume of written work is significantly below what would be expected given the time elapsed.",
      SOME: "Volume is uneven; some periods show adequate output but others show unexplained absence of work.",
      CONSISTENT: "Volume of work is broadly appropriate for the time elapsed and subject demands.",
      STRONG: "The book is full and rich; high expectations for written output are consistently maintained.",
    },
    lookFors: [
      "The book is not sparse",
      "No unexplained absence of work across lessons",
      "Volume reflects the time the student has been in the class",
    ],
  },
];
