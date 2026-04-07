import type { SignalDefinition } from "./signalTypes";
import {
  BOOKS_SCALE,
  CLASSROOM_LESSON_PHASES_PRIMARY,
  GLOBAL_SCALE,
  LESSON_PHASE,
  type LessonPhase,
} from "./signalTypes";
import type { SignalKey } from "./signalTypes";

export const PRIMARY_SIGNAL_KEYS = {
  PRIMARY_BEHAVIOUR_CLIMATE: "PRIMARY_BEHAVIOUR_CLIMATE",
  PRIMARY_PACE_MOMENTUM: "PRIMARY_PACE_MOMENTUM",
  PRIMARY_ENTRY_ROUTINE: "PRIMARY_ENTRY_ROUTINE",
  PRIMARY_RETRIEVAL_TASK_QUALITY: "PRIMARY_RETRIEVAL_TASK_QUALITY",
  PRIMARY_RETRIEVAL_CHECK: "PRIMARY_RETRIEVAL_CHECK",
  PRIMARY_EXPLANATION_CLARITY: "PRIMARY_EXPLANATION_CLARITY",
  PRIMARY_MODELLING_EXPLICITNESS: "PRIMARY_MODELLING_EXPLICITNESS",
  PRIMARY_PHONICS_VOCABULARY_PRECISION: "PRIMARY_PHONICS_VOCABULARY_PRECISION",
  PRIMARY_DIRECTED_QUESTIONING: "PRIMARY_DIRECTED_QUESTIONING",
  PRIMARY_STRETCH_IN_ROOM: "PRIMARY_STRETCH_IN_ROOM",
  PRIMARY_CFU_CYCLES: "PRIMARY_CFU_CYCLES",
  PRIMARY_RESPONSIVE_ADJUSTMENT: "PRIMARY_RESPONSIVE_ADJUSTMENT",
  PRIMARY_ERROR_CORRECTION_PRECISION: "PRIMARY_ERROR_CORRECTION_PRECISION",
  PRIMARY_ORACY_GUIDED: "PRIMARY_ORACY_GUIDED",
  PRIMARY_PARTICIPATION_EQUITY: "PRIMARY_PARTICIPATION_EQUITY",
  PRIMARY_TASK_CLARITY: "PRIMARY_TASK_CLARITY",
  PRIMARY_INDEPENDENT_ACCOUNTABILITY: "PRIMARY_INDEPENDENT_ACCOUNTABILITY",
  PRIMARY_CIRCULATION_FEEDBACK: "PRIMARY_CIRCULATION_FEEDBACK",
  PRIMARY_STRETCH_DEPLOYMENT: "PRIMARY_STRETCH_DEPLOYMENT",
  PRIMARY_ORACY_INDEPENDENT: "PRIMARY_ORACY_INDEPENDENT",
  PRESENTATION_STANDARD: "PRESENTATION_STANDARD",
  WORK_COMPLETION: "WORK_COMPLETION",
  SUSTAINED_EFFORT: "SUSTAINED_EFFORT",
  TASK_APPROPRIATENESS: "TASK_APPROPRIATENESS",
  VOLUME_OF_WORK: "VOLUME_OF_WORK",
} as const satisfies Record<string, SignalKey>;

export const PRIMARY_OBSERVATION_PHASE_PRIMARY_ORDER: Partial<Record<LessonPhase, SignalKey[]>> = {
  [LESSON_PHASE.TRANSITION_START]: [
    PRIMARY_SIGNAL_KEYS.PRIMARY_BEHAVIOUR_CLIMATE,
    PRIMARY_SIGNAL_KEYS.PRIMARY_PACE_MOMENTUM,
    PRIMARY_SIGNAL_KEYS.PRIMARY_ENTRY_ROUTINE,
    PRIMARY_SIGNAL_KEYS.PRIMARY_RETRIEVAL_TASK_QUALITY,
    PRIMARY_SIGNAL_KEYS.PRIMARY_RETRIEVAL_CHECK,
  ],
  [LESSON_PHASE.INSTRUCTION]: [
    PRIMARY_SIGNAL_KEYS.PRIMARY_BEHAVIOUR_CLIMATE,
    PRIMARY_SIGNAL_KEYS.PRIMARY_PACE_MOMENTUM,
    PRIMARY_SIGNAL_KEYS.PRIMARY_EXPLANATION_CLARITY,
    PRIMARY_SIGNAL_KEYS.PRIMARY_MODELLING_EXPLICITNESS,
    PRIMARY_SIGNAL_KEYS.PRIMARY_PHONICS_VOCABULARY_PRECISION,
    PRIMARY_SIGNAL_KEYS.PRIMARY_DIRECTED_QUESTIONING,
    PRIMARY_SIGNAL_KEYS.PRIMARY_STRETCH_IN_ROOM,
  ],
  [LESSON_PHASE.GUIDED_PRACTICE]: [
    PRIMARY_SIGNAL_KEYS.PRIMARY_BEHAVIOUR_CLIMATE,
    PRIMARY_SIGNAL_KEYS.PRIMARY_PACE_MOMENTUM,
    PRIMARY_SIGNAL_KEYS.PRIMARY_CFU_CYCLES,
    PRIMARY_SIGNAL_KEYS.PRIMARY_RESPONSIVE_ADJUSTMENT,
    PRIMARY_SIGNAL_KEYS.PRIMARY_ERROR_CORRECTION_PRECISION,
    PRIMARY_SIGNAL_KEYS.PRIMARY_ORACY_GUIDED,
    PRIMARY_SIGNAL_KEYS.PRIMARY_PARTICIPATION_EQUITY,
  ],
  [LESSON_PHASE.INDEPENDENT_PRACTICE]: [
    PRIMARY_SIGNAL_KEYS.PRIMARY_BEHAVIOUR_CLIMATE,
    PRIMARY_SIGNAL_KEYS.PRIMARY_PACE_MOMENTUM,
    PRIMARY_SIGNAL_KEYS.PRIMARY_TASK_CLARITY,
    PRIMARY_SIGNAL_KEYS.PRIMARY_INDEPENDENT_ACCOUNTABILITY,
    PRIMARY_SIGNAL_KEYS.PRIMARY_CIRCULATION_FEEDBACK,
    PRIMARY_SIGNAL_KEYS.PRIMARY_STRETCH_DEPLOYMENT,
    PRIMARY_SIGNAL_KEYS.PRIMARY_ORACY_INDEPENDENT,
  ],
  [LESSON_PHASE.BOOKS]: [
    PRIMARY_SIGNAL_KEYS.PRESENTATION_STANDARD,
    PRIMARY_SIGNAL_KEYS.WORK_COMPLETION,
    PRIMARY_SIGNAL_KEYS.SUSTAINED_EFFORT,
    PRIMARY_SIGNAL_KEYS.TASK_APPROPRIATENESS,
    PRIMARY_SIGNAL_KEYS.VOLUME_OF_WORK,
  ],
};

function isBookSignal(def: SignalDefinition): boolean {
  return def.phases.length === 1 && def.phases[0] === LESSON_PHASE.BOOKS;
}

export const PRIMARY_SIGNAL_DEFINITIONS: SignalDefinition[] = [
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_BEHAVIOUR_CLIMATE,
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
      STRONG: "Purposeful, calm climate; children self-regulate and learning time is strongly protected.",
    },
    lookFors: [
      "Starts are calm and efficient",
      "Expectations are clear and applied consistently",
      "Low-level issues are handled without derailing the lesson",
    ],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_PACE_MOMENTUM,
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
    lookFors: ["Clear time expectations", "Minimal dead time between activities", "Children begin tasks promptly"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_ENTRY_ROUTINE,
    order: 3,
    displayNameDefault: "Entry routine",
    descriptionDefault:
      "Children transition in, settle, and begin an initial task without negotiation or delay.",
    phases: [LESSON_PHASE.TRANSITION_START],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Chaotic or slow start; heavy prompting before work begins.",
      SOME: "Some children settle quickly; others need repeated direction.",
      CONSISTENT: "Most transition in and begin with minimal prompting.",
      STRONG: "Crisp, automatic routine; all children settle and start without fuss.",
    },
    lookFors: ["Expected start visible on entry", "Children self-start", "No prolonged negotiation"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_RETRIEVAL_TASK_QUALITY,
    order: 4,
    displayNameDefault: "Retrieval task quality",
    descriptionDefault:
      "The start activity demands genuine recall of previously taught content, not busy work.",
    phases: [LESSON_PHASE.TRANSITION_START],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Start task is off-topic, trivial, or not recall-focused.",
      SOME: "Some recall intent but task is too easy or misaligned to prior teaching.",
      CONSISTENT: "Task targets prior learning; recall is genuine and proportionate.",
      STRONG: "Sharp, focused recall that clearly links to the teaching sequence.",
    },
    lookFors: ["Content was taught before", "Recall not copying", "Low stakes but thinking-rich"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_RETRIEVAL_CHECK,
    order: 5,
    displayNameDefault: "Retrieval check",
    descriptionDefault:
      "Teacher actively checks and responds to what children produce, rather than just setting and ignoring.",
    phases: [LESSON_PHASE.TRANSITION_START],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Task set but responses not checked.",
      SOME: "Partial checking; teacher moves on without secure evidence.",
      CONSISTENT: "Evidence gathered before moving on; gaps surfaced.",
      STRONG: "Systematic checking; teaching adjusts from what retrieval shows.",
    },
    lookFors: ["Teacher reviews answers orally or on mini-whiteboards", "Broad sampling", "Feedback before new input"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_EXPLANATION_CLARITY,
    order: 6,
    displayNameDefault: "Explanation clarity",
    descriptionDefault: "Explanations are accurate, logically sequenced, and free from ambiguity.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Explanations confused, inaccurate, or hard to follow.",
      SOME: "Main ideas emerge but sequence or logic sometimes unclear.",
      CONSISTENT: "Accurate, ordered explanations children can follow.",
      STRONG: "Precise, well-structured; common misconceptions anticipated.",
    },
    lookFors: ["Logical steps", "Key ideas singled out", "Children can restate in their own words"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_MODELLING_EXPLICITNESS,
    order: 7,
    displayNameDefault: "Modelling explicitness",
    descriptionDefault:
      "New skills or knowledge are demonstrated with thinking made visible; children see the process not just the outcome.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Little modelling; children asked to perform without a clear example.",
      SOME: "Some demonstration but thinking stays implicit.",
      CONSISTENT: "Clear worked example; steps and reasoning articulated.",
      STRONG: "Exemplary modelling: decisions, success criteria, and pitfalls explicit.",
    },
    lookFors: ["Teacher thinks aloud", "Success criteria visible", "Children know what good looks like"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_PHONICS_VOCABULARY_PRECISION,
    order: 8,
    displayNameDefault: "Phonics & vocabulary precision",
    descriptionDefault:
      "Subject vocabulary and, where relevant, phonics content is used accurately and demanded from children in responses.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Terms misused or avoided; phonics or vocabulary not reinforced.",
      SOME: "Correct use by teacher but weak demand in child responses.",
      CONSISTENT: "Accurate terms and phonics routines; children expected to use them.",
      STRONG: "Embedded correction; children routinely use precise language and sounds.",
    },
    lookFors: ["Key vocabulary defined and revisited", "Phonics applied where curriculum expects", "Loose language corrected"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_DIRECTED_QUESTIONING,
    order: 9,
    displayNameDefault: "Directed questioning",
    descriptionDefault:
      "Questions distributed unpredictably; most children required to think and respond, not just volunteers.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Few children answer; most can stay passive.",
      SOME: "Some directed questioning but predictable or narrow.",
      CONSISTENT: "Broad accountability over the segment.",
      STRONG: "Inclusive, unpredictable, thinking-rich questioning.",
    },
    lookFors: ["Cold call or equivalent", "Wait time", "Follow-ups press for fuller answers"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_STRETCH_IN_ROOM,
    order: 10,
    displayNameDefault: "Stretch in the room",
    descriptionDefault:
      "Teacher presses for depth and justification beyond surface responses; higher-order thinking expected not optional.",
    phases: [LESSON_PHASE.INSTRUCTION],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Stays at recall or one-word answers.",
      SOME: "Occasional stretch for some.",
      CONSISTENT: "Regular ‘why’ and ‘how’ for most children.",
      STRONG: "Systematic demand for reasoning and evidence.",
    },
    lookFors: ["Probing questions", "Children justify", "Higher-order follow-ups"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_CFU_CYCLES,
    order: 11,
    displayNameDefault: "CFU cycles",
    descriptionDefault: "Teacher checks before moving on; checks are genuine and reach most children.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Advances without evidence; rhetorical checks only.",
      SOME: "Some checks but shallow or ignored.",
      CONSISTENT: "Meaningful checks before each step.",
      STRONG: "Tight loops; misconceptions caught early.",
    },
    lookFors: ["Uses oral or written evidence from children", "Pauses for responses", "Next step reflects checks"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_RESPONSIVE_ADJUSTMENT,
    order: 12,
    displayNameDefault: "Responsive adjustment",
    descriptionDefault: "Teaching visibly changes based on what checks reveal.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Fixed script regardless of understanding.",
      SOME: "Minor tweaks; gaps persist.",
      CONSISTENT: "Reteach or pacing change when needed.",
      STRONG: "Agile shifts from live evidence.",
    },
    lookFors: ["Slows or re-explains", "Extra example when many struggle", "Extension when secure"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_ERROR_CORRECTION_PRECISION,
    order: 13,
    displayNameDefault: "Error correction precision",
    descriptionDefault:
      "Misconceptions identified specifically; children required to correct not just told the right answer.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Errors glossed or only labelled wrong.",
      SOME: "Corrections vague.",
      CONSISTENT: "Specific fix; child rehearses correct idea.",
      STRONG: "Child demonstrates improved accuracy before moving on.",
    },
    lookFors: ["Names the misconception", "Modelled correction", "Child re-attempts"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_ORACY_GUIDED,
    order: 14,
    displayNameDefault: "Oracy (guided practice)",
    descriptionDefault:
      "Structured talk is used purposefully; partner or group talk has clear expectations and is monitored for quality.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Talk unfocused or unmanaged.",
      SOME: "Some structure but quality uneven.",
      CONSISTENT: "Clear stems or roles; teacher listens and steers.",
      STRONG: "High-quality paired or group talk on the learning goal.",
    },
    lookFors: ["Sentence stems or talk rules", "Teacher circulates to pairs", "Feedback on how children talk"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_PARTICIPATION_EQUITY,
    order: 15,
    displayNameDefault: "Participation equity",
    descriptionDefault: "Thinking load distributed across the class; no child can remain passive or invisible.",
    phases: [LESSON_PHASE.GUIDED_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Few dominate; others hide.",
      SOME: "Broader at times but pockets of passivity.",
      CONSISTENT: "Most engaged; teacher prevents hiding.",
      STRONG: "Inclusive; accountability evenly spread.",
    },
    lookFors: ["All-corner checks", "Broad sampling of work", "No long single-voice stretches"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_TASK_CLARITY,
    order: 16,
    displayNameDefault: "Task clarity",
    descriptionDefault:
      "Children know exactly what they are doing, to what standard, and for how long before they begin.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Unclear task or success criteria.",
      SOME: "Directions exist but many procedural questions.",
      CONSISTENT: "Clear task, standard, and time; most start confidently.",
      STRONG: "Exemplars and criteria enable self-correction.",
    },
    lookFors: ["Success criteria visible", "Time limit clear", "Children start without repeated clarification"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_INDEPENDENT_ACCOUNTABILITY,
    order: 17,
    displayNameDefault: "Independent accountability",
    descriptionDefault: "Teacher circulates purposefully; completion and accuracy monitored actively.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Little circulation or monitoring.",
      SOME: "Moves but checks unfocused.",
      CONSISTENT: "Purposeful rounds tracking progress.",
      STRONG: "Systematic sampling of every child.",
    },
    lookFors: ["Deliberate path", "Work checked against criteria", "Follow-up on gaps"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_CIRCULATION_FEEDBACK,
    order: 18,
    displayNameDefault: "Circulation feedback",
    descriptionDefault:
      "Feedback during circulation is specific, timely, and requires a child response or correction.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Generic praise only.",
      SOME: "Some specifics inconsistently acted on.",
      CONSISTENT: "Names issue and fix; child adjusts.",
      STRONG: "High-leverage loops in the moment.",
    },
    lookFors: ["Concrete next step", "Child edits work", "Tied to success criteria"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_STRETCH_DEPLOYMENT,
    order: 19,
    displayNameDefault: "Stretch deployment",
    descriptionDefault:
      "Extension work is genuinely challenging; children who finish are extended not just given more of the same.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "No extension or only more of the same.",
      SOME: "Thin extension.",
      CONSISTENT: "Meaningful challenge tasks.",
      STRONG: "Tiered challenge deepens thinking.",
    },
    lookFors: ["Clear next-step task", "Quality of extension monitored", "Avoids busywork"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRIMARY_ORACY_INDEPENDENT,
    order: 20,
    displayNameDefault: "Oracy (independent)",
    descriptionDefault:
      "Where talk is permitted, it is purposeful and on-task; partner discussion is productive not social.",
    phases: [LESSON_PHASE.INDEPENDENT_PRACTICE],
    isUniversal: false,
    scale: GLOBAL_SCALE,
    scaleGuidance: {
      LIMITED: "Talk is social or off-task.",
      SOME: "Mixed; teacher sometimes redirects.",
      CONSISTENT: "Talk stays on the learning goal.",
      STRONG: "Productive peer talk with clear purpose.",
    },
    lookFors: ["Teacher reinforces on-task talk", "Partner tasks have a clear output", "Minimal social noise"],
  },
  {
    key: PRIMARY_SIGNAL_KEYS.PRESENTATION_STANDARD,
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
    key: PRIMARY_SIGNAL_KEYS.WORK_COMPLETION,
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
    key: PRIMARY_SIGNAL_KEYS.SUSTAINED_EFFORT,
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
    key: PRIMARY_SIGNAL_KEYS.TASK_APPROPRIATENESS,
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
    key: PRIMARY_SIGNAL_KEYS.VOLUME_OF_WORK,
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

const PRIMARY_DEFINITION_BY_KEY: Map<SignalKey, SignalDefinition> = new Map(
  PRIMARY_SIGNAL_DEFINITIONS.map((def) => [def.key, def])
);

export const PRIMARY_CLASSROOM_ONLY_SIGNAL_DEFINITIONS: SignalDefinition[] = PRIMARY_SIGNAL_DEFINITIONS.filter(
  (def) =>
    def.isUniversal || (!isBookSignal(def) && def.phases.some((p) => CLASSROOM_LESSON_PHASES_PRIMARY.includes(p)))
).sort((a, b) => a.order - b.order);

export function getSignalsForObservationPhasePrimary(phase: string): SignalDefinition[] {
  const ordered = [...PRIMARY_SIGNAL_DEFINITIONS].sort((a, b) => a.order - b.order);

  if (phase === LESSON_PHASE.UNKNOWN) {
    return PRIMARY_CLASSROOM_ONLY_SIGNAL_DEFINITIONS;
  }

  const keys = PRIMARY_OBSERVATION_PHASE_PRIMARY_ORDER[phase as LessonPhase];
  if (!keys?.length) {
    return ordered;
  }

  return keys.map((k) => PRIMARY_DEFINITION_BY_KEY.get(k)!).filter(Boolean);
}
