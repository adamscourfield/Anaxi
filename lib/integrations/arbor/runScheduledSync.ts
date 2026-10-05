import { prisma } from "@/lib/prisma";

type ScheduledSyncResult = {
  connectionId: string;
  label: string;
  ok: boolean;
  status: number;
  body: unknown;
};

/**
 * Runs an Arbor job once for every connected real-school integration. Requests
 * are intentionally serial: Arbor throttles aggressively and one school's
 * catch-up must not starve the next school's credentials.
 */
export async function runScheduledArborSync(req: Request, path: string): Promise<{ results: ScheduledSyncResult[]; failed: number }> {
  const integrations = await (prisma as any).sharedIntegration.findMany({
    where: { provider: "ARBOR", status: "CONNECTED" },
    select: { id: true, label: true },
    orderBy: { createdAt: "asc" },
  }) as Array<{ id: string; label: string }>;

  const results: ScheduledSyncResult[] = [];
  for (const integration of integrations) {
    const url = new URL(path, req.url);
    url.searchParams.set("connectionId", integration.id);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: req.headers.get("authorization") ?? "",
        "x-arbor-scheduled-sync": "1",
      },
      redirect: "manual",
    });
    const body = await response.json().catch(() => null);
    results.push({ connectionId: integration.id, label: integration.label, ok: response.ok, status: response.status, body });
  }

  return { results, failed: results.filter((result) => !result.ok).length };
}
