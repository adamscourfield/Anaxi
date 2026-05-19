import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

if (!process.env.NEXTAUTH_URL && process.env.REPLIT_DEV_DOMAIN) {
  process.env.NEXTAUTH_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  console.log(
    `[next.config] NEXTAUTH_URL auto-detected from REPLIT_DEV_DOMAIN: ${process.env.NEXTAUTH_URL}`,
  );
}

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV !== "production") {
  process.env.NEXTAUTH_SECRET = "dev-insecure-nextauth-secret";
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
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

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
});
