import { describe, expect, it } from "vitest";
import { attentionViewAllTarget } from "@/modules/home/attentionItems";

describe("attentionViewAllTarget", () => {
  it("links to the first item when multiple alerts exist", () => {
    const target = attentionViewAllTarget([
      { title: "A", detail: "", href: "/on-call", tone: "critical" },
      { title: "B", detail: "", href: "/leave", tone: "warning" },
    ]);
    expect(target.href).toBe("/on-call");
    expect(target.label).toBe("Top priority");
  });

  it("uses Open label for a single alert", () => {
    const target = attentionViewAllTarget([
      { title: "Leave", detail: "", href: "/leave#pending-requests", tone: "warning" },
    ]);
    expect(target.href).toBe("/leave#pending-requests");
    expect(target.label).toBe("Open");
  });
});
