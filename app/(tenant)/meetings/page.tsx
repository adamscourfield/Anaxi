import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { listMeetings, getMeetingStats } from "@/modules/meetings/service";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PastMeetingsList } from "@/components/meetings/PastMeetingsList";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Starting now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `Starts in ${hrs}h ${remainingMins}m` : `Starts in ${hrs}h`;
}

export default async function MeetingsPage({ searchParams }: { searchParams?: { scope?: string; type?: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");

  const canViewAll = hasPermission(user.role, "meetings:view_all");
  const showAll = canViewAll && searchParams?.scope !== "mine";
  const type = searchParams?.type;

  const [meetings, stats] = await Promise.all([
    listMeetings(user.tenantId, {
      type,
      isAttendee: !showAll,
      userId: user.id,
    }),
    getMeetingStats(user.tenantId, canViewAll ? undefined : user.id),
  ]);

  const now = new Date();
  const upcoming = (meetings as any[])
    .filter((m) => new Date(m.startDateTime) >= now)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  const past = (meetings as any[])
    .filter((m) => new Date(m.startDateTime) < now)
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Meetings"
        actions={
          hasPermission(user.role, "meetings:create") ? (
            <Button asChild>
              <Link href="/meetings/new">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                </svg>
                New Meeting
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* ── Stats Cards (KPI row — matches Explorer / Signals) ─────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open Actions"
          value={stats.openActions}
          tone="glass"
          contextVariant="inline"
          context={
            stats.newActionsSinceMonday > 0 ? (
              <span className="font-semibold text-success">
                +{stats.newActionsSinceMonday} since Mon
              </span>
            ) : (
              <span className="font-medium text-muted">No new this week</span>
            )
          }
        />
        <StatCard
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          tone="glass"
          contextVariant="inline"
          context={<span className="font-medium text-muted">Target 95%</span>}
        />
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-surface-container-lowest p-5 shadow-ambient">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Next Up</p>
          {stats.nextMeeting ? (
            <>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="min-w-0 flex-1 text-[1.125rem] font-bold leading-snug tracking-[-0.01em] text-text">
                  {stats.nextMeeting.title}
                </span>
              </div>
              <p className="mt-1.5 text-[0.8125rem] font-medium text-muted">
                {formatTimeUntil(new Date(stats.nextMeeting.startDateTime))}
                {stats.nextMeeting.location ? ` · ${stats.nextMeeting.location}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[0.8125rem] font-medium text-muted">No upcoming meetings</p>
          )}
        </div>
      </div>

      {/* ── Upcoming Meetings ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-[-0.01em] text-text">Upcoming Meetings</h2>
        <hr className="mb-4 border-border/40" />

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-text">No upcoming meetings</p>
            <p className="mt-1 text-xs text-muted">Create a meeting to start capturing decisions and actions.</p>
          </div>
        ) : (
          <div className="table-shell">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-5 py-3 text-left">Meeting Title</th>
                  <th className="px-5 py-3 text-left">Date &amp; Time</th>
                  <th className="px-5 py-3 text-left">Location</th>
                  <th className="px-5 py-3 text-left">Organizer</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((m: any) => {
                  const start = new Date(m.startDateTime);
                  const end = new Date(m.endDateTime);
                  const typeLabel = MEETING_TYPE_LABELS[m.type] ?? m.type;
                  const statusLabel = m.status === "CONFIRMED" ? "Confirmed" : m.status === "CANCELLED" ? "Cancelled" : "Pending";
                  const statusVariant = m.status === "CONFIRMED" ? "success" : m.status === "CANCELLED" ? "error" : "warning";

                  return (
                    <tr key={m.id} className="table-row calm-transition">
                      <td className="px-5 py-4">
                        <Link href={`/meetings/${m.id}`} className="link-subtle font-semibold text-text">
                          <p className="font-semibold text-text">{m.title}</p>
                          <p className="text-xs text-muted">{typeLabel}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-text">
                        <p>{start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        <p className="text-xs text-muted">
                          {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {m.location ? (
                          <span className="flex items-center gap-1.5 text-text">
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-muted">
                              <path fillRule="evenodd" d="M11.536 3.464a5 5 0 010 7.072L8 14.07l-3.536-3.535a5 5 0 117.072-7.072v.001zm-1.414 5.658a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" clipRule="evenodd" />
                            </svg>
                            {m.location}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--secondary-container)] text-xs font-semibold text-text">
                            {getInitials(m.createdBy.fullName)}
                          </div>
                          <span className="text-sm text-text">{m.createdBy.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill variant={statusVariant as any} size="sm">{statusLabel}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Past Meetings ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-[-0.01em] text-text">Past Meetings</h2>
        <PastMeetingsList meetings={past} />
      </section>
    </div>
  );
}
