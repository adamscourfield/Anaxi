import { cookies } from "next/headers";

const COOKIE_PREFIX = "anaxi_invite_";

export function godInviteCookieName(tenantId: string) {
  return `${COOKIE_PREFIX}${tenantId}`;
}

export async function readGodInvitePreview(tenantId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(godInviteCookieName(tenantId))?.value ?? null;
}
