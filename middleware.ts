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
    "/behaviour/:path*",
    "/explorer",
    "/leave/:path*",
    "/meetings/:path*",
    "/my-actions",
    "/observe/:path*",
    "/on-call/:path*",
    "/onboarding",
    "/students/:path*",
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
    "/api/god/:path*",
    "/api/auth/switch-tenant",
    "/api/((?!auth|cron|webhooks|invite|health).*)",
  ],
};
