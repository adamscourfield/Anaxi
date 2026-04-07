// LEGACY — superseded by signalDefinitions.ts and signalDefinitionsPrimary.ts
// Check for remaining imports before deleting. Do not add to this file.

export type ObservationValue = {
  key: "LOW" | "MED" | "HIGH";
  label: string;
  tooltip: string;
};

export type SignalDefinition = {
  key: string;
  label: string;
  description: string;
  values: ObservationValue[];
  universal: boolean;
  phases: string[];
};

const THREE_POINT_VALUES: ObservationValue[] = [
  { key: "LOW", label: "Low", tooltip: "Rarely or inconsistently seen in this lesson segment." },
  { key: "MED", label: "Medium", tooltip: "Partially secure, seen at points with room to strengthen." },
  { key: "HIGH", label: "High", tooltip: "Secure and consistently evident in this lesson segment." }
];

export const OBSERVATION_SIGNALS: SignalDefinition[] = [
  { key: "LEARNING_OBJECTIVE_CLARITY", label: "Learning objective clarity", description: "Students can explain what they are learning and why.", values: THREE_POINT_VALUES, universal: true, phases: [] },
  { key: "EXPLANATION_QUALITY", label: "Explanation quality", description: "Teacher explanations are clear, accurate and appropriately sequenced.", values: THREE_POINT_VALUES, universal: false, phases: ["INPUT", "GUIDED_PRACTICE"] },
  { key: "CHECKING_FOR_UNDERSTANDING", label: "Checking for understanding", description: "Teacher checks understanding and responds to what is found.", values: THREE_POINT_VALUES, universal: true, phases: [] },
  { key: "ADAPTIVE_TEACHING", label: "Adaptive teaching", description: "Instruction is adjusted for learners’ needs in real time.", values: THREE_POINT_VALUES, universal: true, phases: [] },
  { key: "STUDENT_PARTICIPATION", label: "Student participation", description: "Most students are participating and thinking hard.", values: THREE_POINT_VALUES, universal: true, phases: [] },
  { key: "BEHAVIOUR_FOR_LEARNING", label: "Behaviour for learning", description: "Classroom behaviour supports learning and focus.", values: THREE_POINT_VALUES, universal: true, phases: [] },
  { key: "CLASSROOM_CLIMATE", label: "Classroom climate", description: "Environment is safe, respectful and purposeful.", values: THREE_POINT_VALUES, universal: true, phases: [] },
  { key: "ROUTINES_AND_TRANSITIONS", label: "Routines and transitions", description: "Routines and transitions are efficient and predictable.", values: THREE_POINT_VALUES, universal: false, phases: ["DO_NOW", "TRANSITION", "PLENARY"] },
  { key: "QUESTIONING_DEPTH", label: "Questioning depth", description: "Questions probe understanding and extend thinking.", values: THREE_POINT_VALUES, universal: false, phases: ["INPUT", "GUIDED_PRACTICE", "PLENARY"] },
  { key: "FEEDBACK_IN_LESSON", label: "Feedback in lesson", description: "Feedback during the lesson moves learning forward.", values: THREE_POINT_VALUES, universal: false, phases: ["GUIDED_PRACTICE", "INDEPENDENT_PRACTICE"] },
  { key: "PACE_AND_CHALLENGE", label: "Pace and challenge", description: "Pace and level of challenge support progress for the class.", values: THREE_POINT_VALUES, universal: true, phases: [] },
  { key: "SEND_SUPPORT", label: "SEND support", description: "Appropriate support/scaffolds are visible for SEND learners.", values: THREE_POINT_VALUES, universal: true, phases: [] }
];

export const LESSON_PHASES = ["DO_NOW", "INPUT", "GUIDED_PRACTICE", "INDEPENDENT_PRACTICE", "PLENARY", "TRANSITION", "OTHER"] as const;
