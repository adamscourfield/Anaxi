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

// Ensure NEXTAUTH_SECRET is present so NextAuth does not reject JWT operations.
// In Replit the secret should be stored in Secrets; this fallback keeps the dev
// environment working if it has not been configured yet.
if (!process.env.NEXTAUTH_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[next.config] WARNING: NEXTAUTH_SECRET is not set. " +
      "Using an insecure fallback is unsafe in production. " +
      "Set NEXTAUTH_SECRET in your environment secrets."
    );
  }
  process.env.NEXTAUTH_SECRET = "dev-insecure-nextauth-secret";
}

const nextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
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
    ];
  },
};
export default nextConfig;
