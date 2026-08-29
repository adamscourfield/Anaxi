import { describe, it, expect } from "vitest";
import {
  canViewObservation,
  canApproveLeave,
  canViewTeacherAnalysis,
  canViewCpdDrilldown,
  canViewStudentAnalysis,
  canViewExplorer,
  canExportExplorer,
  getExplorerTeacherScope,
  canViewBehaviourExplorer,
  canViewAssessmentExplorer,
  type ViewerContext,
  type ObservationRecord,
  type LeaveRequestRecord,
  type LeaveApprovalGroupRecord,
} from "@/modules/authz/index";

// ─── canViewObservation ───────────────────────────────────────────────────────

describe("canViewObservation", () => {
  const obs: ObservationRecord = {
    observedUserId: "teacher-1",
    observerUserId: "observer-1",
    observedUserDepartmentIds: ["dept-english"],
  };

  it("ADMIN can view any observation", () => {
    const viewer: ViewerContext = {
      userId: "admin-1",
      role: "ADMIN",
      hodDepartmentIds: [],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(true);
  });

  it("SLT can view any observation", () => {
    const viewer: ViewerContext = {
      userId: "slt-1",
      role: "SLT",
      hodDepartmentIds: [],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(true);
  });

  it("SUPER_ADMIN (god mode) can view any observation", () => {
    const viewer: ViewerContext = {
      userId: "super-1",
      role: "SUPER_ADMIN",
      hodDepartmentIds: [],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(true);
  });

  it("Teacher can view their own observation", () => {
    const viewer: ViewerContext = {
      userId: "teacher-1",
      role: "TEACHER",
      hodDepartmentIds: [],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(true);
  });

  it("Observer can view observations they conducted", () => {
    const viewer: ViewerContext = {
      userId: "observer-1",
      role: "TEACHER",
      hodDepartmentIds: [],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(true);
  });

  it("Teacher cannot view another teacher's observation", () => {
    const viewer: ViewerContext = {
      userId: "teacher-2",
      role: "TEACHER",
      hodDepartmentIds: [],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(false);
  });

  it("HOD can view observation for teacher in their department", () => {
    const viewer: ViewerContext = {
      userId: "hod-1",
      role: "HOD",
      hodDepartmentIds: ["dept-english"],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(true);
  });

  it("HOD cannot view observation for teacher in a different department", () => {
    const viewer: ViewerContext = {
      userId: "hod-1",
      role: "HOD",
      hodDepartmentIds: ["dept-maths"],
      coacheeUserIds: [],
    };
    expect(canViewObservation(viewer, obs)).toBe(false);
  });

  it("Coach can view coachee's observation", () => {
    const viewer: ViewerContext = {
      userId: "coach-1",
      role: "TEACHER",
      hodDepartmentIds: [],
      coacheeUserIds: ["teacher-1"],
    };
    expect(canViewObservation(viewer, obs)).toBe(true);
  });

  it("Coach cannot view non-coachee's observation", () => {
    const viewer: ViewerContext = {
      userId: "coach-1",
      role: "TEACHER",
      hodDepartmentIds: [],
      coacheeUserIds: ["teacher-99"],
    };
    expect(canViewObservation(viewer, obs)).toBe(false);
  });
});

// ─── canApproveLeave ──────────────────────────────────────────────────────────

describe("canApproveLeave", () => {
  const leaveRequest: LeaveRequestRecord = { requesterUserId: "teacher-1" };

  it("ADMIN can always approve", () => {
    expect(canApproveLeave("admin-1", "ADMIN", leaveRequest, [])).toBe(true);
  });

  it("SUPER_ADMIN (god mode) can always approve", () => {
    expect(canApproveLeave("super-1", "SUPER_ADMIN", leaveRequest, [])).toBe(true);
  });

  it("approver in ALL_STAFF group can approve anyone", () => {
    const groups: LeaveApprovalGroupRecord[] = [
      {
        appliesTo: "ALL_STAFF",
        approverUserIds: ["hr-1"],
        subjectUserIds: [],
      },
    ];
    expect(canApproveLeave("hr-1", "HR", leaveRequest, groups)).toBe(true);
  });

  it("approver NOT in ALL_STAFF group cannot approve", () => {
    const groups: LeaveApprovalGroupRecord[] = [
      {
        appliesTo: "ALL_STAFF",
        approverUserIds: ["hr-1"],
        subjectUserIds: [],
      },
    ];
    expect(canApproveLeave("hr-2", "HR", leaveRequest, groups)).toBe(false);
  });

  it("SELECTED_MEMBERS group approver can approve covered subject", () => {
    const groups: LeaveApprovalGroupRecord[] = [
      {
        appliesTo: "SELECTED_MEMBERS",
        approverUserIds: ["hr-1"],
        subjectUserIds: ["teacher-1"],
      },
    ];
    expect(canApproveLeave("hr-1", "HR", leaveRequest, groups)).toBe(true);
  });

  it("SELECTED_MEMBERS group approver cannot approve uncovered subject", () => {
    const groups: LeaveApprovalGroupRecord[] = [
      {
        appliesTo: "SELECTED_MEMBERS",
        approverUserIds: ["hr-1"],
        subjectUserIds: ["teacher-99"],
      },
    ];
    expect(canApproveLeave("hr-1", "HR", leaveRequest, groups)).toBe(false);
  });

  it("returns false with no groups", () => {
    expect(canApproveLeave("hr-1", "HR", leaveRequest, [])).toBe(false);
  });
});

// ─── SUPER_ADMIN (god mode) parity with ADMIN ─────────────────────────────────

describe("SUPER_ADMIN has ADMIN-level access everywhere", () => {
  const superAdmin: ViewerContext = {
    userId: "super-1",
    role: "SUPER_ADMIN",
    hodDepartmentIds: [],
    coacheeUserIds: [],
  };

  it("can view teacher analysis for anyone", () => {
    expect(
      canViewTeacherAnalysis(superAdmin, { teacherUserId: "teacher-1", teacherDepartmentIds: [] })
    ).toBe(true);
  });

  it("can view CPD drilldown", () => {
    expect(canViewCpdDrilldown(superAdmin)).toBe(true);
  });

  it("can view student analysis", () => {
    expect(canViewStudentAnalysis(superAdmin)).toBe(true);
  });

  it("can view the Explorer", () => {
    expect(canViewExplorer(superAdmin)).toBe(true);
  });

  it("can export from the Explorer", () => {
    expect(canExportExplorer(superAdmin)).toBe(true);
  });

  it("has no teacher-scope restriction in the Explorer", () => {
    expect(getExplorerTeacherScope(superAdmin)).toBeUndefined();
  });

  it("can view the Behaviour Explorer", () => {
    expect(canViewBehaviourExplorer(superAdmin)).toBe(true);
  });

  it("can view the Assessment Explorer", () => {
    expect(canViewAssessmentExplorer(superAdmin)).toBe(true);
  });
});
