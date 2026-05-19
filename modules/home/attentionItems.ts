export type AttentionTone = "critical" | "warning";

export type AttentionItem = {
  title: string;
  detail: string;
  href: string;
  tone: AttentionTone;
};

export function attentionViewAllTarget(items: AttentionItem[]): { href: string; label: string } {
  if (items.length === 0) {
    return { href: "/home", label: "Overview" };
  }
  const critical = items.filter((i) => i.tone === "critical");
  const primary = critical[0] ?? items[0]!;
  if (items.length === 1) {
    return { href: primary.href, label: "Open" };
  }
  return { href: primary.href, label: "Top priority" };
}
