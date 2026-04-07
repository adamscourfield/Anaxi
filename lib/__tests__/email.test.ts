import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendOnboardingEmail } from "@/lib/email";

// Stub global fetch
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
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

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

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

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

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
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await sendOnboardingEmail({
      to: "teacher@school.example",
      fullName: "Jane Doe",
      tenantName: "Springfield Academy",
    });

    expect(result.status).toBe("sent");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Welcome to Springfield Academy on Anaxi");
    expect(body.text).toContain("Hi Jane Doe");
    expect(body.text).toContain("Springfield Academy");
  });

  it("uses default school name when tenantName is not provided", async () => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    await sendOnboardingEmail({
      to: "teacher@school.example",
      fullName: "Jane Doe",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Welcome to your school on Anaxi");
    expect(body.text).toContain("your school");
  });

  it("returns not_configured when no API key", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendOnboardingEmail({
      to: "teacher@school.example",
      fullName: "Jane Doe",
    });

    expect(result.status).toBe("not_configured");
  });
});
