/**
 * Central authorization module for tenant-scoped visibility rules.
 *
 * These helpers operate purely on data (no Prisma imports) so they can be
 * unit-tested without a database connection.
 */

import { UserRole } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewerContext = {
  userId: string;
  role: UserRole;
  /** IDs of departments where this user isHeadOfDepartment=true */
  hodDepartmentIds: string[];
  /** IDs of users this viewer coaches */
  coacheeUserIds: string[];
};

export type ObservationRecord = {
  /** The observed teacher's userId */
  observedUserId: string;
  /** The observer's userId (person who conducted the observation) */
  observerUserId: string;
  /** Department IDs associated with the observed teacher */
  observedUserDepartmentIds: string[];
};

export type LeaveRequestRecord = {
  requesterUserId: string;
};

export type LeaveApprovalGroupRecord = {
  appliesTo: "ALL_STAFF" | "SELECTED_MEMBERS";
  approverUserIds: string[];
  /** Only used when appliesTo=SELECTED_MEMBERS */
  subjectUserIds: string[];
};

// ─── Observation Visibility ───────────────────────────────────────────────────

/**
 * Determines whether a viewer can see a given observation.
 *
 * Rules:
 * - ADMIN / SLT → always
 * - Viewer is the observed teacher (own record) → true
 * - Viewer is the observer (conducted the observation) → true
 * - HOD viewing someone in a department they lead → true
 * - Viewer is the coach of the observed teacher → true
 */
export function canViewObservation(
  viewer: ViewerContext,
  observation: ObservationRecord
): boolean {
  if (viewer.role === "ADMIN" || viewer.role === "SLT") return true;

  if (viewer.userId === observation.observedUserId) return true;

  if (viewer.userId === observation.observerUserId) return true;

  if (viewer.role === "HOD") {
    const sharedDept = viewer.hodDepartmentIds.some((deptId) =>
      observation.observedUserDepartmentIds.includes(deptId)
    );
    if (sharedDept) return true;
  }

  if (viewer.coacheeUserIds.includes(observation.observedUserId)) return true;

  return false;
}

// ─── Leave Approval Eligibility ───────────────────────────────────────────────

/**
 * Determines whether an approver can approve a leave request.
 *
 * Rules:
 * - ADMIN → can approve all (no group required)
 * - Other roles: must belong to an approval group that covers the requester:
 *   - appliesTo=ALL_STAFF group → approver membership is sufficient
 *   - appliesTo=SELECTED_MEMBERS group → approver membership + requester in subjectUserIds
 */
export function canApproveLeave(
  approverUserId: string,
  approverRole: UserRole,
  leaveRequest: LeaveRequestRecord,
  groups: LeaveApprovalGroupRecord[]
): boolean {
  if (approverRole === "ADMIN") return true;

  for (const group of groups) {
    if (!group.approverUserIds.includes(approverUserId)) continue;

    if (group.appliesTo === "ALL_STAFF") return true;

    if (
      group.appliesTo === "SELECTED_MEMBERS" &&
      group.subjectUserIds.includes(leaveRequest.requesterUserId)
    ) {
      return true;
    }
  }

  return false;
}

// ─── Teacher Analysis Visibility ──────────────────────────────────────────────

export type TeacherAnalysisTarget = {
  /** The userId of the teacher whose profile is being accessed */
  teacherUserId: string;
  /** Department IDs associated with that teacher */
  teacherDepartmentIds: string[];
};

/**
 * Determines whether a viewer can see a teacher's risk analysis profile.
 *
 * Rules:
 * - ADMIN / SLT → can view all teachers
 * - HOD → can view teachers in their departments
 * - Coach (LEADER role with coachee assignment) → can view assigned coachees
 * - TEACHER → can view only themselves
 * - Others → no access
 */
export function canViewTeacherAnalysis(
  viewer: ViewerContext,
  target: TeacherAnalysisTarget
): boolean {
  if (viewer.role === "ADMIN" || viewer.role === "SLT") return true;

  if (viewer.userId === target.teacherUserId) return true;

  if (viewer.role === "HOD") {
    const sharedDept = viewer.hodDepartmentIds.some((deptId) =>
      target.teacherDepartmentIds.includes(deptId)
    );
    if (sharedDept) return true;
  }

  if (viewer.coacheeUserIds.includes(target.teacherUserId)) return true;

  return false;
}

// ─── CPD Drilldown Visibility ──────────────────────────────────────────────────

/**
 * Determines whether a viewer can access the teacher list on a CPD signal
 * drilldown page.
 *
 * Rules:
 * - ADMIN / SLT / HOD → can view teacher lists
 * - LEADER (Coach) with any coachee assignment → can view teacher lists
 * - TEACHER → cannot view teacher lists (CPD summary only)
 */
export function canViewCpdDrilldown(viewer: ViewerContext): boolean {
  if (viewer.role === "ADMIN" || viewer.role === "SLT" || viewer.role === "HOD") return true;
  if (viewer.role === "LEADER" && viewer.coacheeUserIds.length > 0) return true;
  return false;
}

// ─── Student Analysis Visibility ──────────────────────────────────────────────

/**
 * Determines whether a viewer can access the Student Risk Index.
 *
 * Rules:
 * - ADMIN / SLT → full access
 * - HOD → can view all students (pastoral priority)
 * - TEACHER → no access by default (requires STUDENT_ANALYSIS feature flag)
 * - Others → no access
 */
export function canViewStudentAnalysis(viewer: ViewerContext): boolean {
  return viewer.role === "ADMIN" || viewer.role === "SLT" || viewer.role === "HOD";
}

// ─── Explorer Visibility ───────────────────────────────────────────────────────

/**
 * Whether a user can access the Explorer page at all.
 * ADMIN / SLT / HOD → full access; TEACHER → no access
 */
export function canViewExplorer(viewer: ViewerContext): boolean {
  return viewer.role === "ADMIN" || viewer.role === "SLT" || viewer.role === "HOD";
}

/**
 * Whether a user can export CSV from the Explorer.
 * ADMIN / SLT → can export full-school pivots
 * HOD → can export only department-scoped results
 * Others → no export
 */
export function canExportExplorer(viewer: ViewerContext): boolean {
  return viewer.role === "ADMIN" || viewer.role === "SLT" || viewer.role === "HOD";
}

/**
 * Returns the teacher-scope restriction for an Explorer view.
 * ADMIN / SLT → no restriction (undefined = all teachers)
 * HOD → restricted to their department teacher IDs
 * COACH (LEADER with coachees) → restricted to coachee IDs
 * TEACHER → restricted to only themselves
 */
export function getExplorerTeacherScope(viewer: ViewerContext): string[] | undefined {
  if (viewer.role === "ADMIN" || viewer.role === "SLT") return undefined;
  if (viewer.role === "HOD") return undefined; // dept filter applied separately
  if (viewer.coacheeUserIds.length > 0) return viewer.coacheeUserIds;
  return [viewer.userId];
}

/**
 * Whether behaviour views are accessible to this viewer.
 * ADMIN / SLT → full access
 * HOD → full access (whole-school pastoral)
 * Others → no access
 */
export function canViewBehaviourExplorer(viewer: ViewerContext): boolean {
  return viewer.role === "ADMIN" || viewer.role === "SLT" || viewer.role === "HOD";
}

/**
 * Whether assessment analysis views are accessible to this viewer.
 * ADMIN / SLT → full access
 * HOD → full access (can see attainment in their department context)
 * Others → no access
 */
export function canViewAssessmentExplorer(viewer: ViewerContext): boolean {
  return viewer.role === "ADMIN" || viewer.role === "SLT" || viewer.role === "HOD";
}
