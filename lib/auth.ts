import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/types";

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
        tenantId: { label: "Tenant ID (optional)", type: "text" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        const tenantId = credentials?.tenantId?.trim() || null;
        if (!email || !password) return null;

        const candidates = await prisma.user.findMany({
          where: {
            email,
            isActive: true,
            ...(tenantId ? { tenantId } : {})
          }
        });
        if (!candidates.length) return null;

        const matches: typeof candidates = [];
        for (const candidate of candidates) {
          if (!candidate.passwordHash) continue;
          const ok = await bcrypt.compare(password, candidate.passwordHash);
          if (ok) matches.push(candidate);
        }

        if (matches.length !== 1) {
          // Ambiguous identity across tenants (or bad credentials): fail closed.
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
          name: user.fullName
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.user = user;
      }
      if (trigger === "update" && session?.targetTenantId) {
        const currentEmail = (token.user as any)?.email;
        const targetUser = await prisma.user.findFirst({
          where: { email: currentEmail, tenantId: session.targetTenantId, isActive: true },
          select: { id: true, tenantId: true, email: true, fullName: true, role: true, isActive: true }
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
    }
  }
};

export async function getSessionUserOrThrow(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  const tokenUser = (session as any)?.user as SessionUser | undefined;
  if (!tokenUser?.id || !tokenUser?.tenantId) throw new Error("UNAUTHENTICATED");

  const freshUser = await prisma.user.findFirst({
    where: { id: tokenUser.id, tenantId: tokenUser.tenantId, isActive: true },
    select: { id: true, tenantId: true, email: true, fullName: true, role: true, isActive: true }
  });
  if (!freshUser) throw new Error("UNAUTHENTICATED");

  return freshUser as SessionUser;
}

export function assertTenantRecord(recordTenantId: string, userTenantId: string) {
  if (recordTenantId !== userTenantId) throw new Error("FORBIDDEN");
}
