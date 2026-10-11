import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card"; // used for db error display
import { PageHeader } from "@/components/ui/page-header";
import styles from "./page.module.css";
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


  const canManage = canManageStrategy(user.role);

  return (
    <div className={`${styles.page} space-y-8`}>
      {/* Header */}
      <PageHeader variant="ledger"
        title="Strategy Board"
        subtitle="Set school priorities and keep their actions moving."

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
