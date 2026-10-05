export function arborConnectionId(req: Request): string | null {
  const id = new URL(req.url).searchParams.get("connectionId");
  return id?.trim() || null;
}

/** Restricts a God Mode action to the selected connection when supplied. */
export function arborConnectionWhere(req: Request): { provider: "ARBOR"; id?: string } {
  const id = arborConnectionId(req);
  return id ? { provider: "ARBOR", id } : { provider: "ARBOR" };
}

export function arborConnectionHref(path: string, connectionId: string): string {
  const url = new URL(path, "http://anaxi.local");
  url.searchParams.set("connectionId", connectionId);
  return `${url.pathname}${url.search}`;
}
