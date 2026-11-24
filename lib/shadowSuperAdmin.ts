/**
 * Applied when an existing school account becomes a platform super-admin's
 * god-mode ("shadow") account. Shadow accounts are only reachable by switching
 * from the platform account, so they must not keep a password or Microsoft link
 * that someone at the school may know or control.
 */
export const SHADOW_SUPER_ADMIN_RESET = {
  passwordHash: null,
  microsoftTenantId: null,
  microsoftObjectId: null,
} as const;
