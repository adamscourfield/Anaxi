import { UserRole } from "@/lib/types";

export type HomeCardId =
  | "observe.cpd-priorities"
  | "observe.teacher-support-priorities"
  | "culture.cohort-change"
  | "culture.student-support-priorities"
  | "operations.leave-approvals"
  | "operations.meetings-today"
  | "operations.my-open-actions"
  | "operations.my-leave-status"
  | "culture.my-oncall-status"
  | "observe.whole-school-focus"
  | "observe.my-observation-profile"
  | "observe.positive-momentum"
  | "attainment.summary";

export type HomeDataSource =
  | "analysis.computeCpdPriorities"
  | "analysis.computeTeacherRiskIndex"
  | "analysis.computeCohortPivot"
  | "analysis.computeStudentRiskIndex"
  | "analysis.computeTeacherSignalProfile"
  | "analysis.computeCycleSummary"
  | "prisma.lOARequest"
  | "prisma.onCallRequest"
  | "prisma.meeting"
  | "prisma.meetingAction";

export type HomeCardContract = {
  id: HomeCardId;
  title: string;
  domain: "instruction" | "culture" | "operations";
  roles: UserRole[];
  requiredFeatures: string[];
  dataSource: HomeDataSource;
  refreshHintSeconds: number;
};

export const HOME_CARD_CONTRACTS: HomeCardContract[] = [
  {
    id: "observe.cpd-priorities",
    title: "CPD priorities",
    domain: "instruction",
    roles: ["ADMIN", "SLT"],
    requiredFeatures: ["ANALYSIS"],
    dataSource: "analysis.computeCpdPriorities",
    refreshHintSeconds: 300,
  },
  {
    id: "observe.teacher-support-priorities",
    title: "Teacher support priorities",
    domain: "instruction",
    roles: ["ADMIN", "SLT"],
    requiredFeatures: ["ANALYSIS"],
    dataSource: "analysis.computeTeacherRiskIndex",
    refreshHintSeconds: 300,
  },
  {
    id: "culture.cohort-change",
    title: "Cohort change",
    domain: "culture",
    roles: ["ADMIN", "SLT"],
    requiredFeatures: ["ANALYSIS"],
    dataSource: "analysis.computeCohortPivot",
    refreshHintSeconds: 300,
  },
  {
    id: "culture.student-support-priorities",
    title: "Student support priorities",
    domain: "culture",
    roles: ["ADMIN", "SLT"],
    requiredFeatures: ["ANALYSIS", "STUDENT_ANALYSIS"],
    dataSource: "analysis.computeStudentRiskIndex",
    refreshHintSeconds: 300,
  },
  {
    id: "operations.leave-approvals",
    title: "Leave approvals",
    domain: "operations",
    roles: ["ADMIN", "SLT", "HOD"],
    requiredFeatures: ["LEAVE"],
    dataSource: "prisma.lOARequest",
    refreshHintSeconds: 120,
  },
  {
    id: "operations.meetings-today",
    title: "Meetings today",
    domain: "operations",
    roles: ["ADMIN", "SLT", "HOD", "LEADER", "TEACHER", "SUPPORT", "HR", "ON_CALL"],
    requiredFeatures: ["MEETINGS"],
    dataSource: "prisma.meeting",
    refreshHintSeconds: 120,
  },
  {
    id: "operations.my-open-actions",
    title: "My open actions",
    domain: "operations",
    roles: ["ADMIN", "SLT", "HOD", "LEADER", "TEACHER", "SUPPORT", "HR", "ON_CALL"],
    requiredFeatures: ["MEETINGS"],
    dataSource: "prisma.meetingAction",
    refreshHintSeconds: 120,
  },
  {
    id: "operations.my-leave-status",
    title: "My leave status",
    domain: "operations",
    roles: ["ADMIN", "SLT", "HOD", "LEADER", "TEACHER", "SUPPORT", "HR", "ON_CALL"],
    requiredFeatures: ["LEAVE"],
    dataSource: "prisma.lOARequest",
    refreshHintSeconds: 120,
  },
  {
    id: "culture.my-oncall-status",
    title: "My on-call status",
    domain: "culture",
    roles: ["ADMIN", "SLT", "HOD", "LEADER", "TEACHER", "SUPPORT", "HR", "ON_CALL"],
    requiredFeatures: ["ON_CALL"],
    dataSource: "prisma.onCallRequest",
    refreshHintSeconds: 120,
  },
  {
    id: "observe.whole-school-focus",
    title: "Whole-school focus",
    domain: "instruction",
    roles: ["ADMIN", "SLT", "HOD", "LEADER", "TEACHER"],
    requiredFeatures: ["ANALYSIS"],
    dataSource: "analysis.computeCpdPriorities",
    refreshHintSeconds: 300,
  },
  {
    id: "observe.my-observation-profile",
    title: "My observation profile",
    domain: "instruction",
    roles: ["HOD", "LEADER", "TEACHER"],
    requiredFeatures: ["OBSERVATIONS", "ANALYSIS"],
    dataSource: "analysis.computeTeacherSignalProfile",
    refreshHintSeconds: 300,
  },
  {
    id: "observe.positive-momentum",
    title: "Positive momentum",
    domain: "instruction",
    roles: ["ADMIN", "SLT"],
    requiredFeatures: ["ANALYSIS"],
    dataSource: "analysis.computeCpdPriorities",
    refreshHintSeconds: 300,
  },
  {
    id: "attainment.summary",
    title: "Attainment summary",
    domain: "culture",
    roles: ["ADMIN", "SLT"],
    requiredFeatures: ["ASSESSMENTS"],
    dataSource: "analysis.computeCycleSummary",
    refreshHintSeconds: 300,
  },
];
