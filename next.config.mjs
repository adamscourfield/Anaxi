/** @type {import('next').NextConfig} */

// Auto-detect NEXTAUTH_URL for Replit environments.
// Replit sets REPLIT_DEV_DOMAIN to the current project's public domain, so we
// use it when NEXTAUTH_URL has not been explicitly configured. This prevents
// auth failures when the Replit project URL changes or the project is run by a
// different user.
if (!process.env.NEXTAUTH_URL && process.env.REPLIT_DEV_DOMAIN) {
  process.env.NEXTAUTH_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  console.log(`[next.config] NEXTAUTH_URL auto-detected from REPLIT_DEV_DOMAIN: ${process.env.NEXTAUTH_URL}`);
}

// Dev-only fallback; production builds must set NEXTAUTH_SECRET explicitly.
if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV !== "production") {
  process.env.NEXTAUTH_SECRET = "dev-insecure-nextauth-secret";
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/analysis/teachers",
        destination: "/analytics?tab=teachers",
        permanent: true,
      },
      {
        source: "/analysis/cpd",
        destination: "/analytics?tab=cpd",
        permanent: true,
      },
      {
        source: "/analysis/students",
        destination: "/analytics?tab=students",
        permanent: true,
      },
      {
        source: "/leave/pending",
        destination: "/leave#pending-requests",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
