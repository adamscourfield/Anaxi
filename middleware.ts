import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login"
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-insecure-nextauth-secret"
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
    "/god/:path*",
    "/api/god/:path*"
  ]
};
