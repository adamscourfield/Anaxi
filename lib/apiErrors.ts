import { NextResponse } from "next/server";

/** Map thrown auth/feature errors to HTTP responses. */
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
      return NextResponse.json({ error: message }, { status: 400 });
  }
}
