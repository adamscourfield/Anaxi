import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { microsoftEnabled, resolveMicrosoftUser } from "@/lib/microsoftAuth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { getNextAuthSecret } from "@/lib/nextAuthSecret";
import { isActivePlatformSuperAdmin } from "@/lib/platform";

/**
 * NextAuth configuration only — no top-level Prisma or bcrypt import so the
 * `/api/auth/[...nextauth]` bundle stays small and webpack does not trip over
 * a bloated or cyclic module graph (avoids "Cannot read properties of undefined (reading 'call')").
 */
export const authOptions: NextAuthOptions = {
  secret: getNextAuthSecret(),
  session: { strategy: "jwt" },
  pages: { signIn: "/login", signOut: "/login/sign-out", error: "/login" },
  providers: [
    ...(microsoftEnabled() ? [AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: "organizations",
      checks: ["pkce", "state", "nonce"],
      authorization: { params: { scope: "openid profile email", prompt: "select_account" } },
      profile(profile) {
        return { id: profile.sub, name: profile.name, email: profile.email, image: null };
      },
    })] : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantId: { label: "Tenant ID (optional)", type: "text" },
      },
      async authorize(credentials) {
        const { prisma } = await import("@/lib/prisma");
        const bcrypt = (await import("bcryptjs")).default;
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        const tenantId = credentials?.tenantId?.trim() || null;
        if (!email || !password) return null;

        const candidates = await prisma.user.findMany({
          where: {
            email,
            isActive: true,
            ...(tenantId ? { tenantId } : {}),
          },
        });
        if (!candidates.length) return null;

        const matches: typeof candidates = [];
        for (const candidate of candidates) {
          if (!candidate.passwordHash) continue;
          const ok = await bcrypt.compare(password, candidate.passwordHash);
          if (ok) matches.push(candidate);
        }

        if (matches.length !== 1) {
          return null;
        }

        const user = matches[0];
        return {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          name: user.fullName,
        } as any;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "azure-ad") return account?.provider === "credentials";
      const resolved = await resolveMicrosoftUser(profile as Record<string, unknown> | undefined);
      if (!resolved) return false;
      Object.assign(user, resolved, { name: resolved.fullName });
      return true;
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      if (user) {
        token.user = user;
        if (account?.provider === "azure-ad") {
          token.microsoftIdentity = { tid: (profile as any)?.tid, oid: (profile as any)?.oid };
        } else {
          delete token.microsoftIdentity;
        }
      }
      if (trigger === "update" && session?.targetTenantId) {
        const { prisma } = await import("@/lib/prisma");
        const currentEmail = (token.user as any)?.email;
        const targetUser = await prisma.user.findFirst({
          where: {
            email: currentEmail, tenantId: session.targetTenantId, isActive: true,
            ...(token.microsoftIdentity ? {
              microsoftTenantId: (token.microsoftIdentity as any).tid,
              microsoftObjectId: (token.microsoftIdentity as any).oid,
              role: { not: "SUPER_ADMIN" },
            } : {}),
          },
          select: { id: true, tenantId: true, email: true, fullName: true, role: true, isActive: true },
        });
        if (targetUser) {
          // Shadow SUPER_ADMIN rows in schools require a live platform super-admin.
          if (
            targetUser.role === "SUPER_ADMIN" &&
            targetUser.tenantId !== PLATFORM_TENANT_ID
          ) {
            const allowed = await isActivePlatformSuperAdmin(currentEmail);
            if (!allowed) return token;
          }
          token.user = { ...targetUser, name: targetUser.fullName };
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).user = token.user;
      return session;
    },
  },
};
