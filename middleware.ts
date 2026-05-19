import { withAuth } from "next-auth/middleware";
import { getNextAuthSecret } from "@/lib/nextAuthSecret";

export default withAuth({
  pages: {
    signIn: "/login"
  },
  secret: getNextAuthSecret()
});

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
