/**
 * Which other schools a signed-in person may switch into.
 *
 * A matching email is NOT enough: any school admin can create an account with
 * any email address, so email alone would let them become that person at
 * another school. Two accounts are "linked" when they share proof of being the
 * same person:
 *
 *  - Password sign-in: the accounts hold the same password hash. Hashes are
 *    salted, so they only match when "Link accounts" copied one onto the other
 *    (or a password change was applied to both), never by coincidence.
 *  - Microsoft sign-in: the accounts carry the same Microsoft tenant + object id.
 *
 * Platform super-admins entering a school via god mode use their own path
 * (shadow SUPER_ADMIN rows) and are not covered here.
 */
import { prisma } from "@/lib/prisma";

export type MicrosoftIdentity = { tid?: string | null; oid?: string | null } | null | undefined;

type LinkableRow = {
  id: string;
  tenantId: string;
  passwordHash: string | null;
  microsoftTenantId: string | null;
  microsoftObjectId: string | null;
};

export function isLinkedAccount(current: LinkableRow, candidate: LinkableRow, microsoft?: MicrosoftIdentity): boolean {
  if (candidate.id === current.id) return true;
  if (microsoft?.tid && microsoft?.oid) {
    return candidate.microsoftTenantId === microsoft.tid && candidate.microsoftObjectId === microsoft.oid;
  }
  if (current.passwordHash && candidate.passwordHash === current.passwordHash) return true;
  // Microsoft ids are only ever set by Microsoft provisioning, never by school admins.
  return Boolean(
    current.microsoftTenantId &&
      current.microsoftObjectId &&
      candidate.microsoftTenantId === current.microsoftTenantId &&
      candidate.microsoftObjectId === current.microsoftObjectId,
  );
}

const LINK_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  passwordHash: true,
  microsoftTenantId: true,
  microsoftObjectId: true,
  role: true,
} as const;

/** Active accounts for this person (same email) that are linked to the account they are signed in as. */
export async function findLinkedAccounts(currentUserId: string, microsoft?: MicrosoftIdentity) {
  const current = await prisma.user.findUnique({ where: { id: currentUserId }, select: LINK_SELECT });
  if (!current) return [];
  const sameEmail = await prisma.user.findMany({
    where: { email: current.email, isActive: true },
    select: { ...LINK_SELECT, tenant: { select: { name: true } } },
  });
  return sameEmail.filter((row) => isLinkedAccount(current, row, microsoft));
}

/** The linked account at `targetTenantId`, or null if the person has no linked account there. */
export async function findLinkedAccountInTenant(currentUserId: string, targetTenantId: string, microsoft?: MicrosoftIdentity) {
  const linked = await findLinkedAccounts(currentUserId, microsoft);
  return linked.find((row) => row.tenantId === targetTenantId) ?? null;
}
