import Link from "next/link";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { MetaText } from "@/components/ui/typography";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";
import { StatusPill } from "@/components/ui/status-pill";

export default async function EmailLogPage() {
  const user = await requireAdminUser();

  const logs = await prisma.emailLog.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const failedCount = logs.filter((l) => l.status === "FAILED").length;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <AdminPageChrome
        area="Email"
        title="Email delivery log"
        subtitle={
          failedCount > 0
            ? `Recent transactional emails for your school. ${failedCount} failed in this view.`
            : "Recent transactional emails for your school. All recent sends succeeded or were skipped (not configured)."
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Template</th>
              <th className="py-2 pr-3 font-medium">To</th>
              <th className="py-2 pr-3 font-medium">Subject</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  No emails logged yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-muted">
                    {log.createdAt.toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{log.template}</td>
                  <td className="py-2.5 pr-3">{log.toEmail}</td>
                  <td className="py-2.5 pr-3 max-w-[200px] truncate" title={log.subject}>
                    {log.subject}
                  </td>
                  <td className="py-2.5">
                    <StatusPill
                      variant={
                        log.status === "SENT"
                          ? "success"
                          : log.status === "FAILED"
                            ? "error"
                            : "neutral"
                      }
                      size="sm"
                    >
                      {log.status}
                    </StatusPill>
                    {log.errorMessage ? (
                      <div
                        className="mt-1 max-w-xs truncate text-xs text-error"
                        title={log.errorMessage}
                      >
                        {log.errorMessage}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
