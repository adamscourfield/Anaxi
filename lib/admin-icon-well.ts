/** Semantic admin dashboard icon wells (UX-012). */

const WELL_BY_PREFIX: Array<{ prefix: string; well: string }> = [
  { prefix: "/admin/users", well: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]" },
  { prefix: "/admin/settings", well: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]" },
  { prefix: "/admin/departments", well: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]" },
  { prefix: "/admin/taxonomies", well: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]" },
  { prefix: "/admin/coaching", well: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]" },
  { prefix: "/admin/timetable", well: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]" },
  { prefix: "/admin/leave-approvals", well: "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]" },
  { prefix: "/admin/terminology", well: "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]" },
  { prefix: "/admin/features", well: "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]" },
  { prefix: "/admin/language", well: "bg-[color-mix(in_srgb,var(--tertiary)_12%,transparent)] text-[var(--tertiary)]" },
  { prefix: "/admin/signals", well: "bg-[color-mix(in_srgb,var(--tertiary)_12%,transparent)] text-[var(--tertiary)]" },
  { prefix: "/admin/imports", well: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]" },
  { prefix: "/admin/email-log", well: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]" },
  { prefix: "/admin/vocab", well: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]" },
];

export function adminIconWell(href: string): string {
  const match = WELL_BY_PREFIX.find(({ prefix }) => href === prefix || href.startsWith(`${prefix}/`));
  return match?.well ?? "bg-[var(--surface-container-low)] text-muted";
}
