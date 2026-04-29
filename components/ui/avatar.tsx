const COLORS = [
  "bg-[var(--cat-indigo-bg)] text-[var(--cat-indigo-text)]",
  "bg-[var(--scale-strong-light)] text-[var(--scale-strong-text)]",
  "bg-[var(--scale-some-light)] text-[var(--scale-some-text)]",
  "bg-[var(--scale-limited-light)] text-[var(--scale-limited-text)]",
  "bg-[var(--cat-blue-bg)] text-[var(--cat-blue-text)]",
  "bg-[var(--cat-violet-bg)] text-[var(--cat-violet-text)]",
  "bg-[var(--status-approved-light)] text-[var(--status-approved-text)]",
  "bg-[var(--scale-some-border)] text-[var(--scale-some-text)]",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  size = "sm",
  tone = "default",
}: {
  name: string;
  size?: "sm" | "md";
  /** Neutral grey circle (dashboard lists) vs hashed accent colors */
  tone?: "default" | "muted";
}) {
  const initials = getInitials(name);
  const colorClass =
    tone === "muted"
      ? "bg-[var(--surface-container)] text-text"
      : COLORS[hashName(name) % COLORS.length];
  const sizeClass = size === "sm"
    ? "h-7 w-7 text-[10px]"
    : "h-9 w-9 text-[12px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${colorClass} ${sizeClass}`}
      title={name}
    >
      {initials}
    </span>
  );
}
