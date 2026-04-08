import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * NextAuth configuration only — no top-level Prisma or bcrypt import so the
 * `/api/auth/[...nextauth]` bundle stays small and webpack does not trip over
 * a bloated or cyclic module graph (avoids "Cannot read properties of undefined (reading 'call')").
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "dev-insecure-nextauth-secret",
  session: { strategy: "jwt" },
  pages: { signIn: "/login", signOut: "/login/sign-out" },
  providers: [
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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.user = user;
      }
      if (trigger === "update" && session?.targetTenantId) {
        const { prisma } = await import("@/lib/prisma");
        const currentEmail = (token.user as any)?.email;
        const targetUser = await prisma.user.findFirst({
          where: { email: currentEmail, tenantId: session.targetTenantId, isActive: true },
          select: { id: true, tenantId: true, email: true, fullName: true, role: true, isActive: true },
        });
        if (targetUser) {
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
