import crypto from "crypto";

/**
 * An unguessable placeholder password for accounts whose owner will set their
 * own via an emailed link. Nobody is ever told it, so the account cannot be
 * signed into until the link is used.
 */
export function randomUnusablePassword(): string {
  return crypto.randomBytes(32).toString("base64url");
}
