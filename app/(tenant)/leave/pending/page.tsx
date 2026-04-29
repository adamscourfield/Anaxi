import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa, loaManageableRequesterIds } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function businessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const fin = new Date(end);
  fin.setHours(0, 0, 0, 0);
  while (cur <= fin) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-cat-violet-bg text-cat-violet-text",
  "bg-cat-blue-bg text-cat-blue-text",
  "bg-scale-strong-light text-scale-strong-text",
  "bg-scale-limited-light text-scale-limited-text",
  "bg-scale-some-light text-scale-some-text",
  "bg-cat-indigo-bg text-cat-indigo-text",
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

export default async function LeavePendingPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  if (!(await canManageLoa(user))) throw new Error("FORBIDDEN");
  const requesterIds = await loaManageableRequesterIds(user);

  const pending = await (prisma as any).lOARequest.findMany({
    where: {
      tenantId: user.tenantId,
      status: "PENDING",
      AND: [
        { requesterId: { not: user.id } },
        ...(requesterIds ? [{ requesterId: { in: requesterIds } }] : []),
      ],
    },
    include: { requester: true, reason: true },
    orderBy: { startDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <Link href="/leave" className="link-accent text-sm">← Back to Leave of Absence</Link>
      </div>
      <PageHeader
        title="Pending Approvals"
        subtitle={
          pending.length === 0
            ? "You're all caught up — no outstanding requests."
            : `${pending.length} request${pending.length === 1 ? "" : "s"} awaiting your decision.`
        }
        actions={
          <Link
            href="/leave/calendar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-container-lowest/70 px-3.5 py-2 text-sm font-medium text-muted backdrop-blur-sm calm-transition hover:border-accent/30 hover:text-accent"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none">
              <rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3.5 8.2h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Calendar
          </Link>
        }
      />

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-card py-16 shadow-ambient">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-scale-strong-bg">
            <svg className="h-6 w-6 text-scale-strong-bar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-text">All clear</p>
          <p className="mt-1 text-sm text-muted">No pending leave requests right now.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl glass-card shadow-ambient">
          {(pending as any[]).map((request, idx) => {
            const startDate = new Date(request.startDate);
            const endDate = new Date(request.endDate);
            const days = businessDays(startDate, endDate);
            const name = request.requester?.fullName ?? "Staff member";
            const color = avatarColor(name);
            const isLast = idx === pending.length - 1;

            return (
              <div
                key={request.id}
                className={`flex items-center gap-4 px-5 py-4 transition-colors duration-100 hover:bg-surface-container-lowest/50 ${
                  !isLast ? "border-b border-border/30" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold sm:flex ${color}`}
                >
                  {initials(name)}
                </div>

                {/* Name + dates */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[0.875rem] font-semibold text-text">{name}</span>
                    {request.reason?.label && (
                      <span className="shrink-0 text-[0.75rem] text-muted">{request.reason.label}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.75rem] text-muted">
                    <span>{fmt(startDate)}</span>
                    <span className="text-border">→</span>
                    <span>{fmt(endDate)}</span>
                    <span className="rounded-full bg-surface-container-low px-1.5 py-0.5 text-[11px] font-medium text-muted">
                      {days} day{days === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {/* Days visual bar */}
                <div className="hidden flex-col items-end gap-0.5 md:flex">
                  <span className="text-[0.8125rem] font-semibold tabular-nums text-text">{days}</span>
                  <span className="text-[0.6875rem] text-muted">school days</span>
                </div>

                {/* Action */}
                <Link
                  href={`/leave/${request.id}`}
                  className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-[0.8125rem] font-semibold text-on-primary calm-transition anx-card-elevated hover:bg-accentHover"
                >
                  Review
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
