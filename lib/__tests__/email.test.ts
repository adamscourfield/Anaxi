import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        isActive: true,
        emailObservations: true,
        emailMeetings: true,
        emailLeave: true,
        receivesOnCallEmails: true,
      }),
    },
    tenantSettings: {
      findUnique: vi.fn().mockResolvedValue({ timezone: "Europe/London", schoolName: "Test School" }),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: "Test School" }) },
    emailLog: { create: vi.fn().mockResolvedValue({}) },
    passwordResetToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import {
  sendEmail,
  sendOnboardingEmail,
  sendObservationEmail,
  sendMeetingInviteEmail,
  sendLeaveDecisionEmail,
  sendLeaveSubmittedEmail,
} from "@/lib/email";

import { prisma } from "@/lib/prisma";

const fetchMock = vi.fn();

function mockResendOk() {
  return { ok: true, status: 200, json: async () => ({ id: "email_test_id" }) };
}
const activeUserPrefs = {
  isActive: true,
  emailObservations: true,
  emailMeetings: true,
  emailLeave: true,
  receivesOnCallEmails: true,
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUserPrefs as never);
  vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({
    timezone: "Europe/London",
    schoolName: "Test School",
  } as never);
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ name: "Test School" } as never);
  vi.mocked(prisma.emailLog.create).mockResolvedValue({} as never);
  vi.mocked(prisma.passwordResetToken.updateMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.FROM_EMAIL;
});

describe("sendEmail", () => {
  it("returns not_configured when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      message: "Hello",
    });

    expect(result.status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Resend API and returns sent on success", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.FROM_EMAIL = "noreply@test.com";

    fetchMock.mockResolvedValueOnce(mockResendOk());

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test Subject",
      message: "Test Message",
    });

    expect(result.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-key");

    const body = JSON.parse(options.body);
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.from).toBe("noreply@test.com");
    expect(body.subject).toBe("Test Subject");
    expect(body.text).toBe("Test Message");
  });

  it("uses default FROM_EMAIL when not set", async () => {
    process.env.RESEND_API_KEY = "test-key";
    delete process.env.FROM_EMAIL;

    fetchMock.mockResolvedValueOnce(mockResendOk());

    await sendEmail({ to: "user@example.com", subject: "Test", message: "Hello" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe("hi@anaxi.io");
  });

  it("returns failed when Resend returns an error", async () => {
    process.env.RESEND_API_KEY = "test-key";

    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      message: "Hello",
    });

    expect(result.status).toBe("failed");
  });


  it("returns failed when Resend error response has no text method", async () => {
    process.env.RESEND_API_KEY = "test-key";

    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      message: "Hello",
    });

    expect(result.status).toBe("failed");
  });

  it("returns failed when fetch throws a network error", async () => {
    process.env.RESEND_API_KEY = "test-key";

    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      message: "Hello",
    });

    expect(result.status).toBe("failed");
  });
});

describe("sendOnboardingEmail", () => {
  it("sends an email with the correct welcome content", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockResendOk());

    const result = await sendOnboardingEmail({
      to: "teacher@school.example",
      fullName: "Jane Doe",
      tenantId: "tenant_1",
      userId: "user_1",
      tenantName: "Springfield Academy",
    });

    expect(result.status).toBe("sent");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Welcome to Springfield Academy on Anaxi");
    expect(body.text).toContain("Hi Jane Doe");
    expect(body.text).toContain("Set your password");
  });

  it("uses default school name when tenantName is not provided", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockResendOk());

    await sendOnboardingEmail({
      to: "teacher@school.example",
      fullName: "Jane Doe",
      tenantId: "tenant_1",
      userId: "user_1",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toContain("Test School");
  });

  it("returns not_configured when no API key", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendOnboardingEmail({
      to: "teacher@school.example",
      fullName: "Jane Doe",
      tenantId: "tenant_1",
      userId: "user_1",
    });

    expect(result.status).toBe("not_configured");
  });
});

describe("sendObservationEmail", () => {
  it("sends an email with the correct observation content", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockResendOk());

    const result = await sendObservationEmail({
      to: "teacher@school.example",
      teacherName: "Jane Doe",
      observerName: "Bob Smith",
      observationId: "obs_abc123",
      tenantId: "tenant_1",
      teacherUserId: "user_1",
    });

    expect(result.status).toBe("sent");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("New observation from Bob Smith");
    expect(body.text).toContain("Hi Jane Doe");
    expect(body.text).toContain("Bob Smith");
    expect(body.text).toContain("/observe/obs_abc123");
  });

  it("returns not_configured when no API key", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendObservationEmail({
      to: "teacher@school.example",
      teacherName: "Jane Doe",
      observerName: "Bob Smith",
      observationId: "obs_abc123",
      tenantId: "tenant_1",
      teacherUserId: "user_1",
    });

    expect(result.status).toBe("not_configured");
  });
});

describe("sendMeetingInviteEmail", () => {
  it("sends an email with the correct meeting invite content", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockResendOk());

    const result = await sendMeetingInviteEmail({
      to: "attendee@school.example",
      attendeeName: "Carol White",
      title: "Year 10 Review",
      startDateTime: new Date("2026-03-10T09:00:00Z"),
      endDateTime: new Date("2026-03-10T10:00:00Z"),
      meetingId: "mtg_xyz456",
      tenantId: "tenant_1",
      attendeeUserId: "user_2",
      organizerEmail: "org@school.example",
      organizerName: "Org User",
    });

    expect(result.status).toBe("sent");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Meeting invite: Year 10 Review");
    expect(body.text).toContain("Hi Carol White");
    expect(body.text).toContain("Year 10 Review");
    expect(body.text).toContain("/meetings/mtg_xyz456");
  });

  it("returns not_configured when no API key", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendMeetingInviteEmail({
      to: "attendee@school.example",
      attendeeName: "Carol White",
      title: "Year 10 Review",
      startDateTime: new Date("2026-03-10T09:00:00Z"),
      endDateTime: new Date("2026-03-10T10:00:00Z"),
      meetingId: "mtg_xyz456",
      tenantId: "tenant_1",
      attendeeUserId: "user_2",
      organizerEmail: "org@school.example",
      organizerName: "Org User",
    });

    expect(result.status).toBe("not_configured");
  });
});

describe("sendLeaveDecisionEmail", () => {
  it("sends an email for an approved-with-pay decision", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockResendOk());

    const result = await sendLeaveDecisionEmail({
      to: "staff@school.example",
      requesterName: "Alice Green",
      status: "APPROVED_WITH_PAY",
      leaveRequestId: "loa_def789",
      tenantId: "tenant_1",
      requesterUserId: "user_1",
    });

    expect(result.status).toBe("sent");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Your leave request has been approved with pay");
    expect(body.text).toContain("Hi Alice Green");
    expect(body.text).toContain("approved with pay");
    expect(body.text).toContain("/leave/loa_def789");
  });

  it("sends an email for a denied decision", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockResendOk());

    const result = await sendLeaveDecisionEmail({
      to: "staff@school.example",
      requesterName: "Alice Green",
      status: "DENIED",
      leaveRequestId: "loa_def789",
      tenantId: "tenant_1",
      requesterUserId: "user_1",
    });

    expect(result.status).toBe("sent");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Your leave request has been denied");
    expect(body.text).toContain("denied");
    expect(body.text).toContain("/leave/loa_def789");
  });

  it("returns not_configured when no API key", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendLeaveDecisionEmail({
      to: "staff@school.example",
      requesterName: "Alice Green",
      status: "APPROVED_WITHOUT_PAY",
      leaveRequestId: "loa_def789",
      tenantId: "tenant_1",
      requesterUserId: "user_1",
    });

    expect(result.status).toBe("not_configured");
  });
});

describe("sendLeaveSubmittedEmail", () => {
  it("notifies approvers of a new request", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValue(mockResendOk());

    const result = await sendLeaveSubmittedEmail({
      to: ["hr@school.example", "hod@school.example"],
      approverUserIds: ["user_hr", "user_hod"],
      requesterName: "Alice Green",
      reasonLabel: "Medical",
      startDate: new Date("2026-06-10"),
      endDate: new Date("2026-06-12"),
      leaveRequestId: "loa_new123",
      tenantId: "tenant_1",
    });

    expect(result.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toContain("Alice Green");
    expect(body.text).toContain("/leave/loa_new123");
  });
});
