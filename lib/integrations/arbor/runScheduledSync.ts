import { prisma } from "@/lib/prisma";

type ScheduledSyncResult = {
  connectionId: string;
  label: string;
  ok: boolean;
  status: number;
  body: unknown;
};

function isTrustedCanonicalRedirect(from: URL, to: URL) {
  if (from.protocol !== to.protocol) return false;
  return to.host === from.host
    || to.host === `www.${from.host}`
    || from.host === `www.${to.host}`;
}

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
    const request = {
      method: "POST",
      headers: {
        Authorization: req.headers.get("authorization") ?? "",
        "x-arbor-scheduled-sync": "1",
      },
      redirect: "manual",
    } as const;
    let response = await fetch(url, request);

    // The public site redirects anaxi.io to www.anaxi.io. Fetch does not carry
    // an Authorization header across hosts, so follow only this canonical-host
    // redirect ourselves and retain the protected scheduler credentials.
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (location) {
        const redirectedUrl = new URL(location, url);
        if (isTrustedCanonicalRedirect(url, redirectedUrl)) {
          response = await fetch(redirectedUrl, request);
        }
      }
    }
    const body = await response.json().catch(() => null);
    results.push({ connectionId: integration.id, label: integration.label, ok: response.ok, status: response.status, body });
  }

  return { results, failed: results.filter((result) => !result.ok).length };
}
