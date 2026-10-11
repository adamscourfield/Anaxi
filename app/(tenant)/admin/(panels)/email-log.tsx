import styles from "../email-log/page.module.css";
import Link from "next/link";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { MetaText } from "@/components/ui/typography";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";
import { StatusPill } from "@/components/ui/status-pill";
import { ResendEmailButton } from "@/app/(tenant)/admin/(panels)/email-log-resend-button";
import { resendEmail } from "@/app/(tenant)/admin/email-log/actions";

export async function EmailLogAdminPanel() {
  const user = await requireAdminUser();

  const logs = await prisma.emailLog.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const failedCount = logs.filter((l) => l.status === "FAILED").length;

  return (
    <div className={`${styles.page} space-y-8`}>
      <AdminPageChrome
        area="Email"
        title="Email delivery log"
        subtitle="Track delivery status for the latest 100 school emails."
      />

      <section className={styles.stats} aria-label="Email delivery summary">
        {[{label:"Logged emails", value:logs.length}, {label:"Sent", value:logs.filter(log => log.status === "SENT").length}, {label:"Failed", value:failedCount}].map(stat => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}
      </section>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm" aria-label="Recent email deliveries">
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
                  <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>
                  <p>No emails logged yet.</p><p className="mt-2 text-xs">School email deliveries will appear here.</p>
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
                    {log.status === "FAILED" && log.bodyText != null ? (
                      <ResendEmailButton id={log.id} resendAction={resendEmail} />
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

