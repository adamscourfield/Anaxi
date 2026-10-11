import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ vocab: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { tenantVocab: { findMany: db.vocab }, tenantSettings: { findUnique: db.settings } } }));
import { getTenantVocab } from "../vocab";

describe("school vocabulary", () => {
  beforeEach(() => { db.vocab.mockResolvedValue([]); db.settings.mockResolvedValue(null); });
  it("uses behaviour settings for the requested school", async () => {
    db.settings.mockResolvedValue({ detentionLabel: "Rerouting", onCallLabel: "Support Calls" });
    const vocab = await getTenantVocab("school-a");
    expect(vocab.detentions.plural).toBe("Reroutings");
    expect(vocab.on_calls.plural).toBe("Support Calls");
    expect(db.settings).toHaveBeenCalledWith({ where: { tenantId: "school-a" } });
    expect(db.vocab).toHaveBeenCalledWith({ where: { tenantId: "school-a" } });
  });
  it("preserves explicit vocabulary over behaviour labels", async () => {
    db.settings.mockResolvedValue({ detentionLabel: "Rerouting" });
    db.vocab.mockResolvedValue([{ key: "detentions", labelSingular: "Reflection", labelPlural: "Reflections" }]);
    expect((await getTenantVocab("school-b")).detentions.plural).toBe("Reflections");
  });
  it("retains defaults when no custom terminology exists", async () => {
    expect((await getTenantVocab("school-c")).detentions.plural).toBe("Detentions");
  });
});
