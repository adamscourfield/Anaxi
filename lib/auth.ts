import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/types";
import { authOptions } from "@/lib/authOptions";

export { authOptions } from "@/lib/authOptions";

export async function getSessionUserOrThrow(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  const tokenUser = (session as any)?.user as SessionUser | undefined;
  if (!tokenUser?.id || !tokenUser?.tenantId) throw new Error("UNAUTHENTICATED");

  const freshUser = await prisma.user.findFirst({
    where: { id: tokenUser.id, tenantId: tokenUser.tenantId, isActive: true },
    select: { id: true, tenantId: true, email: true, fullName: true, role: true, isActive: true },
  });
  if (!freshUser) throw new Error("UNAUTHENTICATED");

  return freshUser as SessionUser;
}

export function assertTenantRecord(recordTenantId: string, userTenantId: string) {
  if (recordTenantId !== userTenantId) throw new Error("FORBIDDEN");
}
