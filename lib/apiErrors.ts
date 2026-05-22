import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isProduction } from "@/lib/env";
import { captureException } from "@/lib/observability";

/** Map thrown auth/feature errors to HTTP responses. */
const NOT_FOUND_MESSAGES = new Set([
  "meeting not found",
  "action not found",
  "request not found",
  "student not found",
  "owner user not found",
  "attendee user not found in tenant",
  "Not found",
]);

const FORBIDDEN_MESSAGES = new Set([
  "only creator can update meeting",
  "only creator can delete meeting",
  "only owner can block action",
  "only owner can complete action",
  "only owner can update action status",
  "only the requester can cancel",
]);

function isNextDynamicServerUsageError(message: string): boolean {
  return message.startsWith("Dynamic server usage:");
}

export function apiErrorResponse(err: unknown, fallbackMessage = "Request failed"): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: err.flatten() },
      { status: 400 },
    );
  }

  const message = err instanceof Error ? err.message : fallbackMessage;

  switch (message) {
    case "UNAUTHENTICATED":
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    case "FORBIDDEN":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    case "FEATURE_DISABLED":
      return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    case "CSRF_VALIDATION_FAILED":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    default:
      if (NOT_FOUND_MESSAGES.has(message) || message.endsWith(" not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (FORBIDDEN_MESSAGES.has(message) || message.startsWith("only ")) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message.includes("required") || message.includes("Invalid")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      if (isProduction()) {
        if (!isNextDynamicServerUsageError(message)) {
          captureException(err);
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
  }
}
