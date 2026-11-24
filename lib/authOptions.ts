import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { microsoftEnabled, resolveMicrosoftUser } from "@/lib/microsoftAuth";
import CredentialsProvider from "next-auth/providers/credentials";
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
      async authorize(credentials, req) {
        const { prisma } = await import("@/lib/prisma");
        const bcrypt = (await import("bcryptjs")).default;
        const { checkLoginRateLimit, ipFromHeaders } = await import("@/lib/loginRateLimit");
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        const tenantId = credentials?.tenantId?.trim() || null;
        if (!email || !password) return null;

        const limit = await checkLoginRateLimit("signin", ipFromHeaders(req?.headers as Record<string, string> | undefined), email);
        if (!limit.allowed) throw new Error("RATE_LIMITED");

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
        // Switching school. A matching email is not proof of identity (any school
        // admin can create an account with any email), so the target account must
        // be linked to the one signed in: see lib/linkedAccounts.ts.
        const { prisma } = await import("@/lib/prisma");
        const { findLinkedAccountInTenant } = await import("@/lib/linkedAccounts");
        const current = token.user as { id?: string; email?: string; role?: string } | undefined;
        const targetTenantId = String(session.targetTenantId);
        const microsoft = token.microsoftIdentity as { tid?: string; oid?: string } | undefined;
        if (current?.id && current.email) {
          let targetId: string | null = null;
          const linked = await findLinkedAccountInTenant(current.id, targetTenantId, microsoft);
          if (linked && !(microsoft && linked.role === "SUPER_ADMIN")) targetId = linked.id;

          // Platform super-admins move between their god-mode (SUPER_ADMIN) accounts.
          // Trust comes from the account they are signed in as, never the email alone.
          if (
            !targetId &&
            !microsoft &&
            current.role === "SUPER_ADMIN" &&
            (await isActivePlatformSuperAdmin(current.email))
          ) {
            const shadow = await prisma.user.findFirst({
              where: { email: current.email, tenantId: targetTenantId, isActive: true, role: "SUPER_ADMIN" },
              select: { id: true },
            });
            targetId = shadow?.id ?? null;
          }

          if (targetId) {
            const targetUser = await prisma.user.findUnique({
              where: { id: targetId },
              select: { id: true, tenantId: true, email: true, fullName: true, role: true, isActive: true },
            });
            if (targetUser?.isActive) token.user = { ...targetUser, name: targetUser.fullName };
          }
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
