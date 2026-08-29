import type { SignalDefinition } from "./signalTypes";
import {
  BOOKS_SCALE,
  CLASSROOM_LESSON_PHASES_SECONDARY,
  GLOBAL_SCALE,
  LESSON_PHASE,
  type LessonPhase,
} from "./signalTypes";
import type { SignalKey } from "./signalTypes";

export {
  BOOKS_SCALE,
  CLASSROOM_LESSON_PHASES_SECONDARY as CLASSROOM_LESSON_PHASES,
  GLOBAL_SCALE,
  LESSON_PHASE,
  type LessonPhase,
  type ScaleKey,
  type SignalDefinition,
  type SignalKey,
} from "./signalTypes";

export const SIGNAL_KEYS = {
  BEHAVIOUR_CLIMATE: "BEHAVIOUR_CLIMATE",
  PACE_MOMENTUM: "PACE_MOMENTUM",
  ENTRY_ROUTINE: "ENTRY_ROUTINE",
  RETRIEVAL_TASK_QUALITY: "RETRIEVAL_TASK_QUALITY",
  RETRIEVAL_CHECK: "RETRIEVAL_CHECK",
  EXPLANATION_CLARITY: "EXPLANATION_CLARITY",
  MODELLING_EXPLICITNESS: "MODELLING_EXPLICITNESS",
  VOCABULARY_PRECISION: "VOCABULARY_PRECISION",
  DIRECTED_QUESTIONING: "DIRECTED_QUESTIONING",
  STRETCH_IN_ROOM: "STRETCH_IN_ROOM",
  CFU_CYCLES: "CFU_CYCLES",
  RESPONSIVE_ADJUSTMENT: "RESPONSIVE_ADJUSTMENT",
  ERROR_CORRECTION_PRECISION: "ERROR_CORRECTION_PRECISION",
  MODELLING_ON_DEMAND: "MODELLING_ON_DEMAND",
  PARTICIPATION_EQUITY_GP: "PARTICIPATION_EQUITY_GP",
  TASK_CLARITY: "TASK_CLARITY",
  INDEPENDENT_ACCOUNTABILITY_IP: "INDEPENDENT_ACCOUNTABILITY_IP",
  CIRCULATION_FEEDBACK: "CIRCULATION_FEEDBACK",
  STRETCH_DEPLOYMENT_IP: "STRETCH_DEPLOYMENT_IP",
  SILENCE_AND_FOCUS: "SILENCE_AND_FOCUS",
  PRESENTATION_STANDARD: "PRESENTATION_STANDARD",
  WORK_COMPLETION: "WORK_COMPLETION",
  SUSTAINED_EFFORT: "SUSTAINED_EFFORT",
  TASK_APPROPRIATENESS: "TASK_APPROPRIATENESS",
  VOLUME_OF_WORK: "VOLUME_OF_WORK",
} as const satisfies Record<string, SignalKey>;

/**
 * Capture order by lesson phase: universals first (via explicit list), then phase-specific signals.
 * BOOKS: book-look signals only (no classroom universals).
 */
export const OBSERVATION_PHASE_PRIMARY_ORDER: Partial<Record<LessonPhase, SignalKey[]>> = {
  [LESSON_PHASE.THRESHOLD]: [
    SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
    SIGNAL_KEYS.PACE_MOMENTUM,
    SIGNAL_KEYS.ENTRY_ROUTINE,
    SIGNAL_KEYS.RETRIEVAL_TASK_QUALITY,
    SIGNAL_KEYS.RETRIEVAL_CHECK,
  ],
  [LESSON_PHASE.INSTRUCTION]: [
    SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
    SIGNAL_KEYS.PACE_MOMENTUM,
    SIGNAL_KEYS.EXPLANATION_CLARITY,
    SIGNAL_KEYS.MODELLING_EXPLICITNESS,
    SIGNAL_KEYS.VOCABULARY_PRECISION,
    SIGNAL_KEYS.DIRECTED_QUESTIONING,
    SIGNAL_KEYS.STRETCH_IN_ROOM,
  ],
  [LESSON_PHASE.GUIDED_PRACTICE]: [
    SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
    SIGNAL_KEYS.PACE_MOMENTUM,
    SIGNAL_KEYS.CFU_CYCLES,
    SIGNAL_KEYS.RESPONSIVE_ADJUSTMENT,
    SIGNAL_KEYS.ERROR_CORRECTION_PRECISION,
    SIGNAL_KEYS.MODELLING_ON_DEMAND,
    SIGNAL_KEYS.PARTICIPATION_EQUITY_GP,
  ],
  [LESSON_PHASE.INDEPENDENT_PRACTICE]: [
    SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
    SIGNAL_KEYS.PACE_MOMENTUM,
    SIGNAL_KEYS.TASK_CLARITY,
    SIGNAL_KEYS.INDEPENDENT_ACCOUNTABILITY_IP,
    SIGNAL_KEYS.CIRCULATION_FEEDBACK,
    SIGNAL_KEYS.STRETCH_DEPLOYMENT_IP,
    SIGNAL_KEYS.SILENCE_AND_FOCUS,
  ],
  [LESSON_PHASE.BOOKS]: [
    SIGNAL_KEYS.PRESENTATION_STANDARD,
    SIGNAL_KEYS.WORK_COMPLETION,
    SIGNAL_KEYS.SUSTAINED_EFFORT,
    SIGNAL_KEYS.TASK_APPROPRIATENESS,
    SIGNAL_KEYS.VOLUME_OF_WORK,
  ],
};

function isBookSignal(def: SignalDefinition): boolean {
  return def.phases.length === 1 && def.phases[0] === LESSON_PHASE.BOOKS;
}

export const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  {
    key: SIGNAL_KEYS.BEHAVIOUR_CLIMATE,
    order: 1,
    displayNameDefault: "Behaviour & climate",
    descriptionDefault:
      "Learning time is protected; routines are secure and expectations consistently held.",
    phases: [],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Frequent disruption or weak routines; learning time is often lost or negotiated.",
      SOME: "Climate is workable but uneven; routines or expectations slip under pressure.",
      CONSISTENT: "Routines are secure; behaviour supports learning and expectations are held fairly.",
      STRONG: "Purposeful, calm climate; students self-regulate and learning time is strongly protected.",
    },
    lookFors: [
      "Entry and starts are calm and efficient",
      "Expectations are clear and applied consistently",
      "Low-level issues are handled without derailing the lesson",
    ],
  },
  {
    key: SIGNAL_KEYS.PACE_MOMENTUM,
    order: 2,
    displayNameDefault: "Pace & momentum",
    descriptionDefault: "The lesson moves with purpose; dead time is minimal.",
    phases: [],
    isUniversal: true,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Frequent stalls, long waits, or unclear transitions; momentum is often lost.",
      SOME: "Lesson generally moves but with noticeable slow patches or unclear task starts.",
      CONSISTENT: "Steady purposeful pace; transitions and task starts are efficient.",
      STRONG: "Brisk, focused momentum throughout; time is used tightly for learning.",
    },
    lookFors: ["Clear time expectations", "Minimal dead time between activities", "Students begin tasks promptly"],
  },
  {
    key: SIGNAL_KEYS.ENTRY_ROUTINE,
    order: 3,
    displayNameDefault: "Entry routine",
    descriptionDefault: "Students enter, settle, and begin without prompting or negotiation.",
    phases: [LESSON_PHASE.THRESHOLD],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Chaotic or slow entry; heavy teacher prompting needed before work begins.",
      SOME: "Some students settle quickly; others need repeated direction or negotiation.",
      CONSISTENT: "Most students enter and begin expected tasks with minimal prompting.",
      STRONG: "Crisp, automatic entry; all students settle and start without fuss or debate.",
    },
    lookFors: ["Clear expected start task visible on entry", "Students self-start", "No prolonged ‘settling’ conversations"],
  },
  {
    key: SIGNAL_KEYS.RETRIEVAL_TASK_QUALITY,
    order: 4,
    displayNameDefault: "Retrieval task quality",
    descriptionDefault:
      "The Do Now is well-designed: low-stakes, previously taught material, genuinely demanding recall.",
    phases: [LESSON_PHASE.THRESHOLD],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Do Now missing, off-topic, or not retrieval-focused; demands are trivial or misplaced.",
      SOME: "Some retrieval intent but task is too easy, too long, or not aligned to prior teaching.",
      CONSISTENT: "Task targets prior learning appropriately; recall is genuine and proportionate.",
      STRONG: "Do Now is sharply designed: focused, demanding recall, clearly linked to the curriculum sequence.",
    },
    lookFors: ["Content was clearly taught before", "Task requires recall not copying", "Low stakes but cognitively demanding"],
  },
  {
    key: SIGNAL_KEYS.RETRIEVAL_CHECK,
    order: 5,
    displayNameDefault: "Retrieval check",
    descriptionDefault: "Teacher actively checks responses rather than just setting the task and moving on.",
    phases: [LESSON_PHASE.THRESHOLD],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Task is set but responses are not checked; misconceptions or gaps stay hidden.",
      SOME: "Partial checking or only a few voices heard; teacher moves on without secure evidence.",
      CONSISTENT: "Teacher gathers evidence from students before moving on; gaps are surfaced.",
      STRONG: "Systematic checking across the class; teaching adjusts based on what retrieval reveals.",
    },
    lookFors: ["Teacher reviews or probes answers", "Sampling is broad, not only volunteers", "Feedback on retrieval before new input"],
  },
  {
    key: SIGNAL_KEYS.EXPLANATION_CLARITY,
    order: 6,
    displayNameDefault: "Explanation clarity",
    descriptionDefault: "Explanations are accurate, structured, and free from ambiguity.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Explanations are confused, inaccurate, or hard to follow.",
      SOME: "Main ideas come across but steps or logic are sometimes unclear.",
      CONSISTENT: "Explanations are accurate, ordered, and easy for students to follow.",
      STRONG: "Explanations are precise and well-structured; common pitfalls are anticipated and clarified.",
    },
    lookFors: ["Logical sequence from simple to complex", "Key ideas singled out", "Students can restate the idea in their own words"],
  },
  {
    key: SIGNAL_KEYS.MODELLING_EXPLICITNESS,
    order: 7,
    displayNameDefault: "Modelling explicitness",
    descriptionDefault: "New processes are demonstrated with thinking made visible.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Little or no modelling; students asked to perform without a clear worked example.",
      SOME: "Some demonstration but thinking steps or decisions stay implicit.",
      CONSISTENT: "Clear worked example; steps and reasoning are articulated.",
      STRONG: "Exemplary modelling: metacognition, success criteria, and pitfalls made explicit.",
    },
    lookFors: ["Teacher narrates decisions while modelling", "Success criteria visible", "Students clear on ‘what good looks like’"],
  },
  {
    key: SIGNAL_KEYS.VOCABULARY_PRECISION,
    order: 8,
    displayNameDefault: "Vocabulary precision",
    descriptionDefault: "Subject vocabulary is used accurately and demanded from students.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Key terms avoided, misused, or unclear; students not held to precise language.",
      SOME: "Correct vocabulary used by teacher but not consistently reinforced in student talk.",
      CONSISTENT: "Accurate terms taught and used; students expected to use them correctly.",
      STRONG: "Vocabulary is embedded and corrected; students routinely speak with disciplinary precision.",
    },
    lookFors: ["Key terms defined and revisited", "Teacher corrects loose language", "Students use subject terms in answers"],
  },
  {
    key: SIGNAL_KEYS.DIRECTED_QUESTIONING,
    order: 9,
    displayNameDefault: "Directed questioning",
    descriptionDefault:
      "Questions are distributed unpredictably; most students are required to think and respond.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Only volunteers or a few students answer; most can stay passive.",
      SOME: "Some directed questioning but patterns are predictable or coverage is narrow.",
      CONSISTENT: "Broad accountability; questioning reaches most students over the segment.",
      STRONG: "High-quality directed questioning; unpredictable, inclusive, and thinking-rich.",
    },
    lookFors: ["Cold call or equivalent used fairly", "Wait time and thinking time", "Follow-ups press for fuller responses"],
  },
  {
    key: SIGNAL_KEYS.STRETCH_IN_ROOM,
    order: 10,
    displayNameDefault: "Stretch in the room",
    descriptionDefault: "Teacher presses for depth, application, and justification beyond surface responses.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Interactions stay at recall or single-word answers; little press for reasoning.",
      SOME: "Occasional stretch for some students; depth is inconsistent.",
      CONSISTENT: "Regular prompts for why, how, and evidence; most students nudged beyond the surface.",
      STRONG: "Systematic stretch: application, argument, and quality of explanation routinely demanded.",
    },
    lookFors: ["Probing ‘why’ and ‘how’", "Students justify with evidence", "Higher-order follow-ups after initial answers"],
  },
  {
    key: SIGNAL_KEYS.CFU_CYCLES,
    order: 11,
    displayNameDefault: "CFU cycles",
    descriptionDefault: "Teacher checks before moving on; checks are genuine and reach most students.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Teacher advances without evidence; ‘Any questions?’ substitutes for checking.",
      SOME: "Some checks but shallow, rushed, or not acted on.",
      CONSISTENT: "Frequent meaningful checks before each step; responses inform next moves.",
      STRONG: "Tight CFU loops; misconceptions caught early and teaching pivots precisely.",
    },
    lookFors: ["Checks use student work or oral evidence", "Teacher pauses for responses", "Next step reflects what checks showed"],
  },
  {
    key: SIGNAL_KEYS.RESPONSIVE_ADJUSTMENT,
    order: 12,
    displayNameDefault: "Responsive adjustment",
    descriptionDefault: "Teaching visibly changes based on what checks reveal.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Script is followed regardless of student understanding.",
      SOME: "Minor tweaks only; misunderstanding persists for several students.",
      CONSISTENT: "Noticeable reteach, reframe, or pacing change when checks show need.",
      STRONG: "Agile adjustment: groups, examples, or scaffolds shift immediately from live evidence.",
    },
    lookFors: ["Teacher slows or re-explains when needed", "Extra example when many struggle", "Extension when grasp is secure"],
  },
  {
    key: SIGNAL_KEYS.ERROR_CORRECTION_PRECISION,
    order: 13,
    displayNameDefault: "Error correction precision",
    descriptionDefault: "Misconceptions are identified specifically and students are required to correct.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Errors ignored or glossed as ‘wrong’ without precise fix.",
      SOME: "Corrections happen but are vague or don’t secure understanding.",
      CONSISTENT: "Specific error named; student rehearses correct idea or process.",
      STRONG: "Precise, repeatable correction; student demonstrates improved accuracy before moving on.",
    },
    lookFors: ["Naming the misconception", "Modelled correction", "Student re-attempts or verbalises the fix"],
  },
  {
    key: SIGNAL_KEYS.MODELLING_ON_DEMAND,
    order: 14,
    displayNameDefault: "Modelling on demand",
    descriptionDefault: "Teacher re-models or narrates steps when understanding breaks down.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Students left stuck; no additional demonstration when many struggle.",
      SOME: "Occasional help but not structured re-modelling.",
      CONSISTENT: "Timely re-model or step-through when checks show breakdown.",
      STRONG: "Responsive mini-models target exact sticking points; thinking made visible again.",
    },
    lookFors: ["Partial re-model at the board or visually", "Steps broken down further", "Checks follow re-model"],
  },
  {
    key: SIGNAL_KEYS.PARTICIPATION_EQUITY_GP,
    order: 15,
    displayNameDefault: "Participation equity (guided practice)",
    descriptionDefault: "Thinking load is distributed across the class; no student can remain passive.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "A few students dominate; others opt out or are unchallenged.",
      SOME: "Broader participation at times but pockets of passivity remain.",
      CONSISTENT: "Most students engaged in thinking or practice; teacher prevents hiding.",
      STRONG: "Inclusive guided practice; accountability is high and evenly spread.",
    },
    lookFors: ["All-corner questioning or checks", "Written work sampled broadly", "No long stretches of single-voice dialogue"],
  },
  {
    key: SIGNAL_KEYS.TASK_CLARITY,
    order: 16,
    displayNameDefault: "Task clarity",
    descriptionDefault: "Students know exactly what they are doing, to what standard, before they begin.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Task or success criteria unclear; students unsure what ‘done’ means.",
      SOME: "Directions exist but many still ask procedural questions.",
      CONSISTENT: "Clear instructions and quality bar; most start without confusion.",
      STRONG: "Crystal-clear task, examples, and criteria; self-correction is possible.",
    },
    lookFors: ["Written or verbal success criteria", "Exemplar or checklist where helpful", "Students begin without repeated clarification"],
  },
  {
    key: SIGNAL_KEYS.INDEPENDENT_ACCOUNTABILITY_IP,
    order: 17,
    displayNameDefault: "Independent accountability",
    descriptionDefault: "Teacher circulates purposefully; completion and accuracy are monitored actively.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Little circulation; completion and accuracy largely unmonitored.",
      SOME: "Teacher moves but checks are spotty or unfocused.",
      CONSISTENT: "Purposeful rounds; teacher tracks who is stuck and who is finished.",
      STRONG: "Systematic monitoring; every student’s progress is sampled or checked.",
    },
    lookFors: ["Deliberate circulation path", "Book or work checked against criteria", "Follow-up on non-completion"],
  },
  {
    key: SIGNAL_KEYS.CIRCULATION_FEEDBACK,
    order: 18,
    displayNameDefault: "Circulation feedback",
    descriptionDefault: "Feedback during circulation is specific and requires student action.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Generic praise or vague comments; no clear next step for the student.",
      SOME: "Some specific tips but inconsistent or not acted on.",
      CONSISTENT: "Feedback names the issue and the fix; student adjusts work.",
      STRONG: "High-leverage feedback loops; students improve the work in the moment.",
    },
    lookFors: ["Concrete action (‘add…’, ‘fix…’, ‘try…’)", "Student edits in response", "Feedback tied to success criteria"],
  },
  {
    key: SIGNAL_KEYS.STRETCH_DEPLOYMENT_IP,
    order: 19,
    displayNameDefault: "Stretch deployment",
    descriptionDefault: "Extension is available and used; fast finishers are challenged not just given more.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "No extension; fast finishers idle or get only ‘more of the same’.",
      SOME: "Extension exists but is thin or rarely used well.",
      CONSISTENT: "Meaningful stretch tasks; early finishers engage with deeper work.",
      STRONG: "Well-designed tiered challenge; stretch deepens thinking not just volume.",
    },
    lookFors: ["Clear ‘next step’ or challenge task", "Quality of extension work monitored", "Avoids busywork for quick workers"],
  },
  {
    key: SIGNAL_KEYS.SILENCE_AND_FOCUS,
    order: 20,
    displayNameDefault: "Silence & focus",
    descriptionDefault: "Independent work happens in conditions that support sustained thinking.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Noisy or distracted environment; sustained focus is rare.",
      SOME: "Generally workable noise levels but frequent interruptions or off-task chat.",
      CONSISTENT: "Calm working atmosphere; most students concentrate for meaningful stretches.",
      STRONG: "Highly focused independent work; climate actively protects deep thinking.",
    },
    lookFors: ["Quiet or appropriate working noise", "Minimal social distraction", "Teacher reinforces focus expectations"],
  },
  {
    key: SIGNAL_KEYS.PRESENTATION_STANDARD,
    order: 21,
    displayNameDefault: "Presentation standard",
    descriptionDefault: "Work is neat, organised, and reflects pride in output.",
    phases: [LESSON_PHASE.BOOKS],
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
    order: 22,
    displayNameDefault: "Work completion",
    descriptionDefault: "Tasks are finished to the expected level with no unexplained gaps.",
    phases: [LESSON_PHASE.BOOKS],
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
    order: 23,
    displayNameDefault: "Sustained effort",
    descriptionDefault: "Work quality is consistent across the book, not just in isolated entries.",
    phases: [LESSON_PHASE.BOOKS],
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
    order: 24,
    displayNameDefault: "Task appropriateness",
    descriptionDefault: "Written tasks reflect the curriculum intent for that year group and subject.",
    phases: [LESSON_PHASE.BOOKS],
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
    order: 25,
    displayNameDefault: "Volume of work",
    descriptionDefault: "Quantity of written work is appropriate given time elapsed and subject demands.",
    phases: [LESSON_PHASE.BOOKS],
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

const DEFINITION_BY_KEY: Map<SignalKey, SignalDefinition> = new Map(
  SIGNAL_DEFINITIONS.map((def) => [def.key, def])
);

/** All classroom (non-book) signals for capture: universals + phase-specific, excluding deprecated keys. */
export const CLASSROOM_ONLY_SIGNAL_DEFINITIONS: SignalDefinition[] = SIGNAL_DEFINITIONS.filter(
  (def) =>
    !def.deprecated &&
    (def.isUniversal || (!isBookSignal(def) && def.phases.some((p) => CLASSROOM_LESSON_PHASES_SECONDARY.includes(p))))
).sort((a, b) => a.order - b.order);

/**
 * Signals for capture: universals + phase-specific for the given phase; book look uses book signals only.
 * UNKNOWN (“Not sure”): all classroom signals (universals + every phase-specific classroom signal), not book signals.
 */
export function getSignalsForObservationPhase(phase: string): SignalDefinition[] {
  const ordered = [...SIGNAL_DEFINITIONS].sort((a, b) => a.order - b.order);

  if (phase === LESSON_PHASE.UNKNOWN) {
    return CLASSROOM_ONLY_SIGNAL_DEFINITIONS;
  }

  const keys = OBSERVATION_PHASE_PRIMARY_ORDER[phase as LessonPhase];
  if (!keys?.length) {
    return ordered;
  }

  return keys.map((k) => DEFINITION_BY_KEY.get(k)!).filter(Boolean);
}
