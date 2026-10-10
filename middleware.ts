import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getNextAuthSecret } from "@/lib/nextAuthSecret";
import {
  CSRF_COOKIE,
  CSRF_COOKIE_OPTIONS,
  CSRF_HEADER,
  createCsrfToken,
} from "@/lib/csrf-shared";

function withCsrf(req: NextRequest) {
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  const token = existing ?? createCsrfToken();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CSRF_HEADER, token);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!existing) {
    res.cookies.set(CSRF_COOKIE, token, CSRF_COOKIE_OPTIONS);
  }

  return res;
}

export default withAuth(
  function middleware(req) {
    return withCsrf(req);
  },
  {
    pages: {
      signIn: "/login",
    },
    secret: getNextAuthSecret(),
  },
);

export const config = {
  matcher: [
    "/home",
    "/admin/:path*",
    "/analysis/:path*",
    "/assessments/:path*",
    "/explorer",
    "/leave/:path*",
    "/meetings/:path*",
    "/my-actions",
    "/observe/:path*",
    "/on-call/:path*",
    "/onboarding",
    "/students/:path*",
    "/classes/:path*",
    "/api/assessments/:path*",
    "/api/students/:path*",
    "/api/oncall/:path*",
    "/api/email/:path*",
    "/api/csv/:path*",
    "/api/leave/:path*",
    "/api/meetings/:path*",
    "/api/actions/:path*",
    "/api/import/:path*",
    "/api/notifications/:path*",
    "/api/explorer/:path*",
    "/api/admin/:path*",
    "/god/:path*",
    // These workers authenticate scheduled calls with CRON_SECRET themselves.
    // Let those internal jobs reach their route instead of redirecting to login.
    "/api/god/((?!integrations/arbor/sync/photos|integrations/arbor/sync/morning-attendance|integrations/arbor/sync/timetable|integrations/arbor/preview/assessments/history).*)",
    "/api/auth/switch-tenant",
    // The secure Arbor workers are excluded above and here; the broader API
    // matcher would otherwise still send their internal jobs to sign-in.
    "/api/((?!auth|cron|webhooks|invite|health|god/integrations/arbor/sync/photos|god/integrations/arbor/sync/morning-attendance|god/integrations/arbor/sync/timetable|god/integrations/arbor/preview/assessments/history).*)",
  ],
};
