import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { getMyActions, getOverdueActions } from "@/modules/actions/service";
import { MyActionsGrouped } from "@/components/actions/MyActionsGrouped";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";

export default async function MyActionsPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");

  const [grouped, overdueCount] = await Promise.all([
    getMyActions(user.tenantId, user.id),
    getOverdueActions(user.tenantId, user.id),
  ]);

  const openCount = grouped.OPEN?.length ?? 0;
  const blockedCount = grouped.BLOCKED?.length ?? 0;
  const doneCount = grouped.DONE?.length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader variant="ledger"
        eyebrow="Operations"
        title="My Actions"
        subtitle="Stay on top of meeting follow-ups and deadlines."
        meta={
          <>
            <StatusPill variant="neutral">{openCount} open</StatusPill>
            {overdueCount > 0
              ? <StatusPill variant="warning">{overdueCount} overdue</StatusPill>
              : <StatusPill variant="success">On track</StatusPill>}
          </>
        }
        actions={
          <Link href="/meetings" className="anx-btn-pill-ghost calm-transition font-semibold">
            <svg className="anx-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Meetings
          </Link>
        }
      />

      {/* Stat strip — KPI row aligned with Explorer */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          layout="kpi"
          label="Open"
          value={openCount}
          tone="glass"
          href="#open"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2Z" />
            </svg>
          }
          iconTileClassName="bg-[var(--cat-violet-bg)] text-[var(--cat-violet-text)]"
          valueClassName="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text"
          context={
            overdueCount > 0 ? (
              <span className="font-semibold text-[var(--error)]">{overdueCount} overdue</span>
            ) : (
              <span className="font-medium text-muted">On track</span>
            )
          }
        />
        <StatCard
          layout="kpi"
          label="Blocked"
          value={blockedCount}
          tone="glass"
          href="#blocked"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d="M12 7v5l3 2" />
            </svg>
          }
          iconTileClassName="bg-[var(--scale-some-light)] text-scale-some-text"
          valueClassName={`mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums ${blockedCount > 0 ? "text-text" : "text-muted"}`}
          context={
            blockedCount > 0 ? (
              <span className="font-semibold text-[var(--warning)]">Needs unblock</span>
            ) : (
              <span className="font-medium text-muted">None waiting</span>
            )
          }
        />
        <StatCard
          layout="kpi"
          label="Done"
          value={doneCount}
          tone="glass"
          href="#done"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
            </svg>
          }
          iconTileClassName="bg-[var(--status-approved-light)] text-[var(--status-approved-text)]"
          valueClassName={`mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums ${doneCount > 0 ? "text-text" : "text-muted"}`}
          context={<span className="font-medium text-muted">Completed</span>}
        />
      </div>

      {/* Overdue notice */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--error)_22%,transparent)] bg-[color-mix(in_srgb,var(--pill-error-bg)_35%,transparent)] px-5 py-3.5">
          <svg className="h-4 w-4 flex-shrink-0 text-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth="2.5" />
          </svg>
          <p className="text-[0.8125rem] text-error">
            You have <strong>{overdueCount}</strong> overdue action{overdueCount !== 1 ? "s" : ""} — mark them done or speak to the meeting organiser.
          </p>
        </div>
      )}

      <MyActionsGrouped grouped={grouped as any} currentUserId={user.id} />
    </div>
  );
}
