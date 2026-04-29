import Link from "next/link";
import { ReactNode } from "react";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader } from "@/components/ui/page-header";

type AdminRow = {
  href: string;
  label: string;
  desc: string;
  icon: ReactNode;
  badge?: ReactNode;
};

/** Tinted icon wells — matches Institutional Dashboard reference (purple / blue / green / amber). */
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
  if (href === "/admin/leave-approvals" || href === "/admin/terminology") {
    return "bg-[rgba(245,158,11,0.12)] text-[#b45309]";
  }
  if (href === "/admin/imports") {
    return "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]";
  }
  return "bg-[var(--surface-container-low)] text-muted";
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const UsersIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const DepartmentsIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const CoachingIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const LeaveApprovalsIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const TerminologyIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M5 8l5 10M2 8h8M10 8l1.5-3" />
    <path d="M14 11h8M18 7v8" />
  </svg>
);

const TaxonomiesIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <line x1="14" y1="4" x2="21" y2="4" />
    <line x1="14" y1="8" x2="21" y2="8" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <line x1="14" y1="15" x2="21" y2="15" />
    <line x1="14" y1="19" x2="21" y2="19" />
  </svg>
);

const TimetableIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ImportsIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <polyline points="9 15 12 12 15 15" />
  </svg>
);

const ChevronRight = () => (
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

// ─── Row component ────────────────────────────────────────────────────────────

function AdminRowItem({ row, isLast }: { row: AdminRow; isLast: boolean }) {
  const well = rowIconWell(row.href);
  return (
    <Link href={row.href} className="group block">
      <div className={`flex items-center gap-4 px-5 py-4 calm-transition group-hover:bg-[color-mix(in_srgb,var(--surface-container-low)_65%,transparent)] ${!isLast ? "border-b border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)]" : ""}`}>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl [&_svg]:shrink-0 calm-transition group-hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${well}`}>
          {row.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">{row.label}</span>
            {row.badge}
          </div>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{row.desc}</p>
        </div>
        <ChevronRight />
      </div>
    </Link>
  );
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({ title, tag, rows }: { title: string; tag: string; rows: AdminRow[] }) {
  return (
    <section className="space-y-0">
      <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.06)]">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminIndexPage() {
  const user = await requireAdminUser();

  const tid = user.tenantId;

  const [loaCount, onCallReasonCount, locationCount, recipientCount, timetableCount, activeJobCount] =
    await Promise.all([
      prisma.loaReason.count({ where: { tenantId: tid } }),
      (prisma as any).onCallReason.count({ where: { tenantId: tid } }),
      (prisma as any).onCallLocation.count({ where: { tenantId: tid } }),
      (prisma as any).onCallRecipient.count({ where: { tenantId: tid } }),
      (prisma as any).timetableEntry.count({ where: { tenantId: tid } }),
      prisma.importJob.count({ where: { tenantId: tid, status: { in: ["PENDING", "PROCESSING", "RUNNING"] } } }),
    ]);

  const taxonomyCount = loaCount + onCallReasonCount + locationCount + recipientCount;

  const hasTimetable = timetableCount > 0;

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title="Institutional Dashboard"
        titleClassName="text-pretty text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.035em] text-text"
        subtitle="Manage foundational administrative architecture, staff hierarchies, and semantic datasets from a single unified ledger."
        subtitleClassName="max-w-full text-pretty text-sm font-medium leading-relaxed text-muted/90 md:max-w-2xl"
        className="border-b border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] pb-8"
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface-container-lowest px-4 py-2 text-[0.8125rem] font-medium text-text shadow-sm calm-transition hover:border-outline-variant hover:bg-surface-container-low"
            >
              <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter
            </button>
            <a
              href="/api/admin/ledger/export"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] px-4 py-2 text-[0.8125rem] font-semibold text-[var(--on-primary)] shadow-[var(--shadow-btn)] calm-transition hover:opacity-95 hover:shadow-[var(--shadow-btn-hover)] motion-safe:hover:-translate-y-px"
            >
              <svg className="h-3.5 w-3.5 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Ledger
            </a>
          </>
        }
      />

      {/* ── People & Access ─────────────────────────────────────────── */}
      <Section
        title="People & Access"
        tag="Foundation"
        rows={[
          { href: "/admin/users", label: "Users", desc: "Manage staff profiles, role-based access, and identity authentication.", icon: <UsersIcon /> },
          { href: "/admin/departments", label: "Departments", desc: "Organize institutional structures and faculty hierarchies.", icon: <DepartmentsIcon /> },
          { href: "/admin/coaching", label: "Coaching", desc: "Track professional development and mentorship programs.", icon: <CoachingIcon /> },
          { href: "/admin/leave-approvals", label: "Leave Approvals", desc: "Review absence requests and maintain staffing continuity.", icon: <LeaveApprovalsIcon /> },
        ]}
      />

      {/* ── Platform & Language ─────────────────────────────────────── */}
      <Section
        title="Platform & Language"
        tag="Standardization"
        rows={[
          { href: "/admin/settings", label: "Settings", desc: "Configure global system behaviors and security protocols.", icon: <SettingsIcon /> },
          { href: "/admin/terminology", label: "Terminology", desc: "Customize internal nomenclature and system-wide labels.", icon: <TerminologyIcon /> },
        ]}
      />

      {/* ── Data & Imports ──────────────────────────────────────────── */}
      <Section
        title="Data & Imports"
        tag="Processing"
        rows={[
          {
            href: "/admin/taxonomies",
            label: "Taxonomies",
            desc: "Manage complex categorical hierarchies and tagging systems.",
            icon: <TaxonomiesIcon />,
            badge: taxonomyCount > 0 ? (
              <StatusPill variant="neutral" size="sm">{taxonomyCount} {taxonomyCount === 1 ? "Category" : "Categories"}</StatusPill>
            ) : undefined,
          },
          {
            href: "/admin/timetable",
            label: "Timetable",
            desc: "Review and override institutional scheduling matrices.",
            icon: <TimetableIcon />,
            badge: hasTimetable ? (
              <StatusPill variant="success" size="sm">Synced</StatusPill>
            ) : undefined,
          },
          {
            href: "/admin/imports",
            label: "Import Jobs",
            desc: "Bulk data ingestion, validation logs, and sync history.",
            icon: <ImportsIcon />,
            badge: activeJobCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-text">
                <span className="h-1.5 w-1.5 rounded-full bg-text" />
                {activeJobCount === 1 ? "Active Job" : `${activeJobCount} Active Jobs`}
              </span>
            ) : undefined,
          },
        ]}
      />
    </div>
  );
}
