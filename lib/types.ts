export type UserRole = "SUPER_ADMIN" | "TEACHER" | "LEADER" | "HOD" | "SLT" | "ADMIN" | "HR" | "ON_CALL" | "SUPPORT";
export type FeatureKey =
  | "OBSERVATIONS"
  | "SIGNALS"
  | "STUDENTS"
  | "STUDENTS_IMPORT"
  | "BEHAVIOUR_IMPORT"
  | "LEAVE"
  | "ON_CALL"
  | "MEETINGS"
  | "TIMETABLE"
  | "ADMIN"
  | "ADMIN_SETTINGS"
  | "ANALYSIS"
  | "STUDENT_ANALYSIS"
  | "ASSESSMENTS";

export const ALL_FEATURE_KEYS: FeatureKey[] = [
  "OBSERVATIONS", "SIGNALS", "STUDENTS", "STUDENTS_IMPORT", "BEHAVIOUR_IMPORT",
  "LEAVE", "ON_CALL", "MEETINGS", "TIMETABLE", "ADMIN", "ADMIN_SETTINGS",
  "ANALYSIS", "STUDENT_ANALYSIS", "ASSESSMENTS",
];

export type SessionUser = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};
