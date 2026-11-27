import { randomBytes } from "crypto";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArborClient } from "@/lib/integrations/arbor/client";

const client = new ArborClient({ schoolHostname: "example", username: "test", password: "test" });
afterEach(() => vi.unstubAllGlobals());

describe("Arbor photo imports", () => {
  it("resizes a genuine large source photo into a bounded profile image", async () => {
    const original = await sharp(randomBytes(2048 * 2048 * 3), { raw: { width: 2048, height: 2048, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
    expect(original.length).toBeGreaterThan(2 * 1024 * 1024);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(original))));
    const photo = await client.getStudentPhoto("pupil");
    expect(photo?.mimeType).toBe("image/webp");
    expect(photo!.bytes.length).toBeLessThan(2 * 1024 * 1024);
    const metadata = await sharp(photo!.bytes).metadata();
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
  });

  it("preserves an existing supported small image", async () => {
    const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(original))));
    const photo = await client.getStaffPhoto("staff");
    expect(photo?.mimeType).toBe("image/png");
    expect(photo?.bytes.equals(original)).toBe(true);
  });

  it("rejects a source that exceeds the download limit without a declared length", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(25 * 1024 * 1024 + 1))));
    await expect(client.getStudentPhoto("pupil")).rejects.toThrow("larger than 25MB");
  });
});
