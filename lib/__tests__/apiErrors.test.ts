import { describe, expect, it, afterEach } from "vitest";
import { apiErrorResponse } from "@/lib/apiErrors";

describe("apiErrorResponse", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("maps UNAUTHENTICATED to 401", async () => {
    const res = apiErrorResponse(new Error("UNAUTHENTICATED"));
    expect(res.status).toBe(401);
  });

  it("hides unexpected errors in production", async () => {
    process.env.NODE_ENV = "production";
    const res = apiErrorResponse(new Error("database connection leaked detail"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("database connection");
  });

  it("returns validation-style errors in production", async () => {
    process.env.NODE_ENV = "production";
    const res = apiErrorResponse(new Error("title required"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("title required");
  });
});
