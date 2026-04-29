import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card"; // used for db error display
import { PageHeader } from "@/components/ui/page-header";
import { StrategyBoardClient } from "./StrategyBoardClient";

// ─── Auth guard ───────────────────────────────────────────────────────────────

function canViewStrategy(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "SLT", "HEAD_TEACHER", "DEPUTY_HEAD"].includes(role);
}

function canManageStrategy(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "SLT", "HEAD_TEACHER"].includes(role);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StrategyPage() {
  const user = await getSessionUserOrThrow();

  if (!canViewStrategy(user.role)) notFound();

  let areas: any[] = [];
  let dbError: string | null = null;
  try {
    areas = await (prisma as any).strategyArea.findMany({
      where:   { tenantId: user.tenantId },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [
        { completed: "asc" },
        { createdAt: "desc" },
      ],
    });
  } catch (err: any) {
    dbError = err?.message ?? "Database error";
  }

  // Fetch staff list for the lead person search
  let staffList: { id: string; fullName: string }[] = [];
  try {
    staffList = await (prisma as any).user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
  } catch {
    // Non-critical — fall back to empty list
  }

  const totalAreas     = areas.length;
  const activeAreas    = areas.filter((a: any) => !a.completed).length;
  const completedAreas = areas.filter((a: any) => a.completed).length;

  const canManage = canManageStrategy(user.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader variant="ledger"
        title="Strategy Board"
        subtitle={<>{activeAreas} active · {completedAreas} complete · {totalAreas} total</>}
        actions={
          <>
            <button type="button" className="anx-btn-pill-ghost calm-transition">
              <svg className="anx-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              Filter
            </button>
            <button type="button" className="anx-btn-pill-primary calm-transition">
              <svg className="h-3.5 w-3.5 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Ledger
            </button>
          </>
        }
      />

      {/* DB error — table may need to be created via prisma db push */}
      {dbError && (
        <Card className="border-error/30 bg-error/5 p-4 text-sm">
          <p className="font-semibold text-error">Database setup required</p>
          <p className="mt-1 text-muted">
            The Strategy Board tables are not yet in the database. Run{" "}
            <code className="rounded bg-bg px-1 py-0.5 font-mono text-xs">npx prisma db push</code>{" "}
            to create them, then reload this page.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="mt-2 break-all font-mono text-[11px] text-muted">{dbError}</p>
          )}
        </Card>
      )}

      {/* Board — client component handles interactivity */}
      {!dbError && (
        <StrategyBoardClient
          areas={areas}
          canManage={canManage}
          staffList={staffList}
        />
      )}
    </div>
  );
}
