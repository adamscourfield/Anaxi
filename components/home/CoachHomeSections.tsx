import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill, PillVariant } from "@/components/ui/status-pill";
import { HomeCardHeading, HomePrimaryLink } from "@/components/home/home-chrome";
import { TeacherRiskRow, RiskStatus } from "@/modules/analysis/teacherRisk";
import { IconUsersTwo } from "@/components/home/home-chrome";

const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  SIGNIFICANT_DRIFT: "Significant",
  EMERGING_DRIFT: "Emerging",
  STABLE: "Stable",
  LOW_COVERAGE: "Low coverage",
};

const RISK_STATUS_PILL: Record<RiskStatus, PillVariant> = {
  SIGNIFICANT_DRIFT: "error",
  EMERGING_DRIFT: "warning",
  STABLE: "success",
  LOW_COVERAGE: "neutral",
};

export function CoacheePrioritiesCard({
  coacheeRows,
  windowDays,
  coacheeCount,
}: {
  coacheeRows: TeacherRiskRow[];
  windowDays: number;
  coacheeCount: number;
}) {
  return (
    <Card className="flex min-h-0 flex-col gap-5 rounded-sm !p-6 shadow-none">
      <HomeCardHeading
        icon={<IconUsersTwo />}
        iconTileClassName="bg-[var(--tertiary-container)] text-[var(--on-primary)] shadow-none [&_svg]:text-[var(--on-primary)]"
        title="Your coachees"
        subtitle={`${coacheeCount} assigned · ${windowDays}-day window`}
        end={
          <Link
            href={`/analytics?tab=teachers&window=${windowDays}`}
            className="link-accent shrink-0 text-xs font-semibold"
          >
            All priorities →
          </Link>
        }
      />
      {coacheeRows.length === 0 ? (
        <p className="text-sm text-muted">No coachees showing drift signals in this window — check back after more observations.</p>
      ) : (
        <ul className="space-y-1">
          {coacheeRows.map((row) => (
            <li key={row.teacherMembershipId}>
              <Link
                href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                className="home-row-link flex items-center justify-between gap-2 p-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={row.teacherName} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{row.teacherName}</p>
                    <p className="text-[11px] text-muted">{row.teacherCoverage} obs</p>
                  </div>
                </div>
                <StatusPill variant={RISK_STATUS_PILL[row.status]} size="sm">
                  {RISK_STATUS_LABELS[row.status]}
                </StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <HomePrimaryLink href="/instruction/teachers">Coachee directory →</HomePrimaryLink>
        <HomePrimaryLink href="/observe/new">New observation</HomePrimaryLink>
      </div>
    </Card>
  );
}
