import { NextResponse } from "next/server";

/** Map thrown auth/feature errors to HTTP responses. */
const NOT_FOUND_MESSAGES = new Set([
  "meeting not found",
  "action not found",
  "Not found",
]);

const FORBIDDEN_MESSAGES = new Set([
  "only creator can update meeting",
  "only creator can delete meeting",
  "only owner can block action",
  "only owner can complete action",
  "only owner can update action status",
]);

export function apiErrorResponse(err: unknown, fallbackMessage = "Request failed"): NextResponse {
  const message = err instanceof Error ? err.message : fallbackMessage;

  switch (message) {
    case "UNAUTHENTICATED":
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    case "FORBIDDEN":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    case "FEATURE_DISABLED":
      return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    default:
      if (NOT_FOUND_MESSAGES.has(message)) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (FORBIDDEN_MESSAGES.has(message)) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
  }
}
