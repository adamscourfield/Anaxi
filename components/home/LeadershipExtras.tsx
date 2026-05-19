import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MetaText } from "@/components/ui/typography";
import { HomeCardHeadingSm } from "@/components/home/home-chrome";
import { AttainmentPanel, type AttainmentKPIRow } from "@/components/dashboard/AttainmentPanel";
import { CohortPivotRow } from "@/modules/analysis/cohortPivot";
import { CpdPriorityRow } from "@/modules/analysis/cpdPriorities";
import { IconTrendDown, IconTrendUp } from "@/components/home/home-chrome";

export function MeetingsTodayCard({ count }: { count: number }) {
  return (
    <Card className="flex flex-col gap-2 rounded-sm !p-5 shadow-none">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Meetings today</p>
        <Link href="/meetings" className="text-xs font-semibold text-[var(--primary)] calm-transition hover:opacity-80">
          Calendar →
        </Link>
      </div>
      <p className="text-[2rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums">{count}</p>
      <MetaText>Scheduled across the school today</MetaText>
    </Card>
  );
}

export function CohortChangeCard({ cohortRows, windowDays }: { cohortRows: CohortPivotRow[]; windowDays: number }) {
  const declining = cohortRows
    .filter((r) => r.attendanceDelta !== null && r.attendanceDelta < -0.5)
    .sort((a, b) => (a.attendanceDelta ?? 0) - (b.attendanceDelta ?? 0))
    .slice(0, 3);

  if (declining.length === 0) return null;

  return (
    <Card className="space-y-4 rounded-sm !p-6 shadow-none">
      <HomeCardHeadingSm
        icon={<IconTrendDown className="text-[var(--warning)]" />}
        title="Cohort change"
        subtitle={`Attendance movement — ${windowDays}-day window`}
        end={
          <Link href={`/analytics?tab=students&window=${windowDays}`} className="link-accent shrink-0 text-xs font-semibold">
            Students →
          </Link>
        }
      />
      <ul className="space-y-2">
        {declining.map((row) => (
          <li key={row.yearGroup} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-container-low)] px-3 py-2">
            <span className="text-sm font-medium text-text">Year {row.yearGroup}</span>
            <span className="text-sm font-semibold tabular-nums text-negative">
              {(row.attendanceDelta ?? 0).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PositiveMomentumCard({
  topImproving,
  windowDays,
}: {
  topImproving: CpdPriorityRow[];
  windowDays: number;
}) {
  if (topImproving.length === 0) return null;

  return (
    <Card className="space-y-4 rounded-sm !p-6 shadow-none">
      <HomeCardHeadingSm
        icon={<IconTrendUp className="text-positive" />}
        title="Positive momentum"
        subtitle="Signals with the most teachers improving"
        end={
          <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="link-accent shrink-0 text-xs font-semibold">
            CPD →
          </Link>
        }
      />
      <ul className="space-y-2">
        {topImproving.slice(0, 3).map((row) => (
          <li key={row.signalKey}>
            <Link
              href={`/analysis/cpd/${row.signalKey}?window=${windowDays}`}
              className="home-row-link flex items-center justify-between gap-3 rounded-lg px-3 py-2"
            >
              <span className="text-sm font-medium text-text">{row.label}</span>
              <span className="text-sm font-bold tabular-nums text-positive">
                {Math.round(row.improvingRate * 100)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AttainmentSummaryCard({
  rows,
  windowDays,
}: {
  rows: AttainmentKPIRow[];
  windowDays: number;
}) {
  if (rows.length === 0) return null;
  return (
    <AttainmentPanel
      rows={rows}
      subtitle="Latest assessment cycle proxies"
      ctaHref={`/assessments?window=${windowDays}`}
      ctaLabel="Open assessments"
    />
  );
}
