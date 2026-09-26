import crypto from "crypto";

/**
 * Encrypts and decrypts the credentials a school's MIS integration (e.g. Arbor) is
 * connected with, so `TenantIntegration.credentialsCiphertext` never holds plaintext.
 *
 * Uses AES-256-GCM. The stored blob is `base64(iv[12] || authTag[16] || ciphertext)` —
 * self-contained, so no separate columns are needed for the IV or auth tag.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Resolves INTEGRATION_ENCRYPTION_KEY: a base64-encoded 32-byte key. In production a
 * missing or wrong-length key is a hard error — this guards credentials for every
 * connected school, so there is no safe default to fall back to. Development may use
 * a fixed insecure key so the app still boots without extra setup.
 */
function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INTEGRATION_ENCRYPTION_KEY must be set in production. Refusing to start with an insecure default."
      );
    }
    // 32 zero bytes, base64-encoded — obviously not for production, but keeps local
    // dev and tests working without extra setup.
    return Buffer.alloc(32, 0);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256-GCM."
    );
  }
  return key;
}

/** Encrypts a JSON-serializable credentials object into the ciphertext blob to store. */
export function encryptCredentials(credentials: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypts a blob produced by encryptCredentials back into the original credentials
 * object. Throws if the key is wrong or the blob has been tampered with — GCM's auth
 * tag check fails closed rather than returning corrupted data.
 */
export function decryptCredentials<T = unknown>(blob: string): T {
  const key = getKey();
  const raw = Buffer.from(blob, "base64");
  if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Malformed credentials ciphertext.");
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
