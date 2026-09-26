import { describe, expect, it } from "vitest";
import { decryptCredentials, encryptCredentials } from "@/lib/integrationSecrets";

describe("integration credential encryption", () => {
  it("round-trips an arbitrary JSON-serializable object", () => {
    const credentials = { arborSiteId: "school-123", apiKey: "super-secret-value" };
    const blob = encryptCredentials(credentials);
    expect(blob).not.toContain("super-secret-value");
    expect(decryptCredentials(blob)).toEqual(credentials);
  });

  it("produces a different blob each time (random IV)", () => {
    const credentials = { apiKey: "same-value" };
    const first = encryptCredentials(credentials);
    const second = encryptCredentials(credentials);
    expect(first).not.toBe(second);
  });

  it("fails closed when the ciphertext has been tampered with", () => {
    const blob = encryptCredentials({ apiKey: "value" });
    const bytes = Buffer.from(blob, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a byte in the ciphertext
    expect(() => decryptCredentials(bytes.toString("base64"))).toThrow();
  });

  it("rejects a malformed (too-short) blob", () => {
    expect(() => decryptCredentials(Buffer.from("short").toString("base64"))).toThrow(
      /Malformed credentials ciphertext/
    );
  });
});
