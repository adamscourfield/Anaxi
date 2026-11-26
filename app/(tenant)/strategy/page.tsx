import { notFound } from "next/navigation";
import { requireFeatureForPage } from "@/lib/guards";
import { canManageStrategy, canViewStrategy } from "@/modules/strategy/access";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import styles from "./page.module.css";
import { StrategyBoardClient } from "./StrategyBoardClient";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StrategyPage() {
  const user = await getSessionUserOrThrow();

  await requireFeatureForPage(user.tenantId, "STRATEGY");
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
    console.error("[strategy] failed to load", err);
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


  const canManage = canManageStrategy(user.role);

  return (
    <div className={`${styles.page} space-y-8`}>
      {/* Header */}
      <PageHeader variant="ledger"
        title="Strategy Board"
        subtitle="The school's priorities, who leads each one, and the actions that move them on."
      />

      {dbError && (
        <Card className="p-5 text-sm">
          <p className="font-semibold">The Strategy Board couldn&apos;t load</p>
          <p className="mt-1 text-muted">Refresh the page. If it keeps happening, contact Anaxi support.</p>
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
