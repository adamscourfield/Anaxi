"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { StatusPill } from "@/components/ui/status-pill";

export type AdminIconId =
  | "users"
  | "departments"
  | "coaching"
  | "leaveApprovals"
  | "settings"
  | "features"
  | "terminology"
  | "language"
  | "signals"
  | "taxonomies"
  | "timetable"
  | "imports";

export type RowBadge =
  | { type: "taxonomy"; count: number }
  | { type: "timetable"; synced: boolean }
  | { type: "imports"; activeCount: number };

export type DashboardMetricDef = {
  label: string;
  value: string | number;
  detail: string;
  href?: string;
  iconId: AdminIconId;
  tone?: "default" | "success" | "warning" | "critical";
};

export type DashboardAttentionDef = {
  title: string;
  detail: string;
  href: string;
  tone: "critical" | "warning" | "success";
  cta?: string;
};

export type DashboardRowDef = {
  href: string;
  label: string;
  desc: string;
  iconId: AdminIconId;
  badge?: RowBadge;
};

export type DashboardSectionDef = {
  title: string;
  tag: string;
  rows: DashboardRowDef[];
};

function rowIconWell(href: string): string {
  if (href === "/admin/users" || href === "/admin/settings") {
    return "bg-[rgba(99,102,241,0.10)] text-[#4f46e5]";
  }
  if (href === "/admin/departments" || href === "/admin/taxonomies") {
    return "bg-[rgba(59,130,246,0.10)] text-[#2563eb]";
  }
  if (href === "/admin/coaching" || href === "/admin/timetable") {
    return "bg-[rgba(16,185,129,0.10)] text-[#059669]";
  }
  if (href === "/admin/leave-approvals" || href === "/admin/terminology" || href === "/admin/features") {
    return "bg-[rgba(245,158,11,0.12)] text-[#b45309]";
  }
  if (href === "/admin/language" || href === "/admin/signals") {
    return "bg-[rgba(124,58,237,0.10)] text-[#6d28d9]";
  }
  if (href === "/admin/imports") {
    return "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]";
  }
  return "bg-[var(--surface-container-low)] text-muted";
}

const ICONS: Record<AdminIconId, ReactNode> = {
  users: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  departments: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  coaching: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  leaveApprovals: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  settings: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  features: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="6" width="18" height="12" rx="6" />
      <circle cx="15" cy="12" r="3" />
    </svg>
  ),
  terminology: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M5 8l5 10M2 8h8M10 8l1.5-3" />
      <path d="M14 11h8M18 7v8" />
    </svg>
  ),
  language: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 5h8M8 3v2M10 5c-.6 3.8-2.6 6.5-6 8" />
      <path d="M5 9c1.1 1.8 2.7 3.3 5 4.6" />
      <path d="M14 20l4-10 4 10M15.2 17h5.6" />
    </svg>
  ),
  signals: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 14a8 8 0 018-8M4 20a14 14 0 0114-14" strokeLinecap="round" />
      <circle cx="7" cy="17" r="2" />
      <path d="M15 13l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  taxonomies: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <line x1="14" y1="4" x2="21" y2="4" />
      <line x1="14" y1="8" x2="21" y2="8" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="14" y1="15" x2="21" y2="15" />
      <line x1="14" y1="19" x2="21" y2="19" />
    </svg>
  ),
  timetable: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  imports: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  ),
};

function RowBadgeView({ badge }: { badge: RowBadge }) {
  if (badge.type === "taxonomy" && badge.count > 0) {
    return (
      <StatusPill variant="neutral" size="sm">
        {badge.count} {badge.count === 1 ? "Category" : "Categories"}
      </StatusPill>
    );
  }
  if (badge.type === "timetable" && badge.synced) {
    return (
      <StatusPill variant="success" size="sm">
        Synced
      </StatusPill>
    );
  }
  if (badge.type === "imports" && badge.activeCount > 0) {
    const n = badge.activeCount;
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-text">
        <span className="h-1.5 w-1.5 rounded-full bg-text" />
        {n === 1 ? "Active Job" : `${n} Active Jobs`}
      </span>
    );
  }
  return null;
}

function ChevronRight() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0 text-muted/30 calm-transition group-hover:translate-x-0.5 group-hover:text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function AdminRowItem({
  row,
  isLast,
}: {
  row: DashboardRowDef;
  isLast: boolean;
}) {
  const well = rowIconWell(row.href);
  const icon = ICONS[row.iconId];
  const badgeEl = row.badge ? <RowBadgeView badge={row.badge} /> : null;

  return (
    <Link href={row.href} className="group block">
      <div
        className={`flex items-center gap-4 px-5 py-4 calm-transition group-hover:bg-[color-mix(in_srgb,var(--surface-container-low)_65%,transparent)] ${!isLast ? "border-b border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)]" : ""}`}
      >
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl [&_svg]:shrink-0 calm-transition group-hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${well}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">{row.label}</span>
            {badgeEl}
          </div>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{row.desc}</p>
        </div>
        <ChevronRight />
      </div>
    </Link>
  );
}

function SectionBlock({ title, tag, rows }: DashboardSectionDef) {
  return (
    <section className="space-y-0">
      <div className="overflow-hidden rounded-2xl anx-elevated-card">
        <div className="flex items-baseline justify-between gap-4 border-b border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-text">{title}</h2>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/55">{tag.toUpperCase()}</span>
        </div>
        <div>
          {rows.map((row, i) => (
            <AdminRowItem key={row.href} row={row} isLast={i === rows.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function rowMatchesQuery(row: DashboardRowDef, q: string): boolean {
  if (!q) return true;
  const hay = `${row.label} ${row.desc} ${row.href}`.toLowerCase();
  return hay.includes(q);
}

function sectionMatchesQuery(section: DashboardSectionDef, q: string): boolean {
  if (!q) return true;
  const sectionHay = `${section.title} ${section.tag}`.toLowerCase();
  if (sectionHay.includes(q)) return true;
  return section.rows.some((r) => rowMatchesQuery(r, q));
}

function AdminMetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted">
      <span className="text-muted/70 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      {label}
    </span>
  );
}

function toneClasses(tone: DashboardMetricDef["tone"] = "default") {
  if (tone === "critical") return "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)]";
  if (tone === "warning") return "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)]";
  if (tone === "success") return "bg-[var(--pill-success-bg)] text-[var(--pill-success-text)]";
  return "bg-[var(--surface-container)] text-muted";
}

function MetricCard({ metric }: { metric: DashboardMetricDef }) {
  const content = (
    <div className="home-hero-glass home-pressable-card flex h-full min-h-[142px] flex-col justify-between rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClasses(metric.tone)}`}>
          {ICONS[metric.iconId]}
        </span>
        {metric.href ? <ChevronRight /> : null}
      </div>
      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{metric.label}</p>
        <p className="mt-1 text-[2rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums">{metric.value}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{metric.detail}</p>
      </div>
    </div>
  );

  if (!metric.href) return content;
  return (
    <Link href={metric.href} className="block h-full">
      {content}
    </Link>
  );
}

function AttentionBand({ items }: { items: DashboardAttentionDef[] }) {
  const visible = items.length > 0
    ? items
    : [
        {
          title: "Admin workspace healthy",
          detail: "Core setup data is available and there are no active import jobs.",
          href: "/admin/imports",
          tone: "success" as const,
          cta: "Review",
        },
      ];

  const bandTone = visible.some((item) => item.tone === "critical")
    ? "border-[color-mix(in_srgb,var(--error)_16%,transparent)] bg-[color-mix(in_srgb,var(--pill-error-bg)_58%,var(--surface-container-lowest))]"
    : visible.some((item) => item.tone === "warning")
      ? "border-[color-mix(in_srgb,var(--warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--pill-warning-bg)_70%,var(--surface-container-lowest))]"
      : "border-[color-mix(in_srgb,var(--success)_14%,transparent)] bg-[color-mix(in_srgb,var(--pill-success-bg)_72%,var(--surface-container-lowest))]";

  return (
    <section className={`rounded-2xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:px-5 ${bandTone}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--error)] text-sm font-bold text-white shadow-sm">
            !
          </span>
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            {visible.slice(0, 3).map((item) => (
              <Link
                key={`${item.title}-${item.href}`}
                href={item.href}
                className="group min-w-0 rounded-xl px-2 py-1 calm-transition hover:bg-white/55"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      item.tone === "critical" ? "bg-[var(--error)]" : item.tone === "warning" ? "bg-[var(--warning)]" : "bg-[var(--success)]"
                    }`}
                  />
                  <p className="truncate text-sm font-semibold tracking-[-0.01em] text-text">{item.title}</p>
                </div>
                <p className="mt-0.5 truncate pl-4 text-xs text-muted">{item.detail}</p>
              </Link>
            ))}
          </div>
        </div>
        <Link
          href={visible[0]?.href ?? "/admin"}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold text-text shadow-sm ring-1 ring-inset ring-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] calm-transition hover:bg-white"
        >
          {visible[0]?.cta ?? "View action"}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

export function InstitutionalDashboard({
  sections,
  metrics,
  attentionItems,
  updatedAtLabel,
}: {
  sections: DashboardSectionDef[];
  metrics: DashboardMetricDef[];
  attentionItems: DashboardAttentionDef[];
  updatedAtLabel: string;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const q = query.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((sec) => {
        if (!sectionMatchesQuery(sec, q)) return null;
        const sectionHay = `${sec.title} ${sec.tag}`.toLowerCase();
        if (sectionHay.includes(q)) return sec;
        const rows = sec.rows.filter((r) => rowMatchesQuery(r, q));
        return { ...sec, rows };
      })
      .filter(Boolean) as DashboardSectionDef[];
  }, [sections, q]);

  useEffect(() => {
    if (filterOpen) inputRef.current?.focus();
  }, [filterOpen]);

  const toggleFilter = useCallback(() => {
    setFilterOpen((o) => !o);
  }, []);

  const filterActive = filterOpen || q.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 anx-page-header-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="anx-eyebrow">Dashboard</p>
            <h1 className="anx-page-title">Admin Pulse</h1>
            <p className="anx-page-subtitle">
              Operational setup, data readiness, and administrative controls for your school in one place.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <AdminMetaChip
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                }
                label="Admin workspace"
              />
              <AdminMetaChip
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                }
                label={`Updated ${updatedAtLabel}`}
              />
              <AdminMetaChip
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path d="M12 3 20 7v5c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V7l8-4Z" />
                  </svg>
                }
                label="Role-protected controls"
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleFilter}
              aria-expanded={filterOpen}
              aria-controls={panelId}
              className={`anx-btn-pill-ghost calm-transition ${
                filterActive
                  ? "border-[color-mix(in_srgb,var(--primary)_28%,var(--outline-variant))] bg-surface-container-low"
                  : ""
              }`}
            >
              <svg className="anx-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter
            </button>
            <a href="/api/admin/ledger/export" className="anx-btn-pill-primary calm-transition">
              <svg className="h-3.5 w-3.5 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Ledger
            </a>
          </div>
        </div>

        {filterOpen ? (
          <div
            id={panelId}
            className="filter-panel rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.06)]"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Search destinations</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, description, or path…"
                autoComplete="off"
                className="field w-full max-w-xl rounded-xl border border-border/60 bg-surface-container-lowest py-2.5 pl-3 pr-3 text-[0.875rem] text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>
            {q ? (
              <p className="mt-2 text-[0.8125rem] text-muted">
                Showing <span className="font-semibold text-text">{visibleSections.reduce((n, s) => n + s.rows.length, 0)}</span>{" "}
                destination{visibleSections.reduce((n, s) => n + s.rows.length, 0) === 1 ? "" : "s"}
                {visibleSections.length < sections.length ? (
                  <>
                    {" "}
                    in <span className="font-semibold text-text">{visibleSections.length}</span> section
                    {visibleSections.length === 1 ? "" : "s"}
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-[0.8125rem] text-muted">Type to narrow the list. Section titles match too.</p>
            )}
          </div>
        ) : null}
      </div>

      <AttentionBand items={attentionItems} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      {visibleSections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface-container-low/40 px-6 py-12 text-center">
          <p className="text-sm font-medium text-text">No destinations match &ldquo;{query.trim()}&rdquo;</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-sm font-semibold text-accent hover:text-accentHover calm-transition"
          >
            Clear search
          </button>
        </div>
      ) : (
        <section className="grid gap-5 xl:grid-cols-3">
          {visibleSections.map((sec) => <SectionBlock key={sec.title} {...sec} />)}
        </section>
      )}
    </div>
  );
}
