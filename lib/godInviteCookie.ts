import { cookies } from "next/headers";

const COOKIE_PREFIX = "anaxi_invite_";

export function godInviteCookieName(tenantId: string) {
  return `${COOKIE_PREFIX}${tenantId}`;
}

export function readGodInvitePreview(tenantId: string): string | null {
  const store = cookies();
  return store.get(godInviteCookieName(tenantId))?.value ?? null;
}
