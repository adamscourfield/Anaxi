import { parseAdminSection } from "@/lib/admin-sections";
import { renderAdminPanel } from "@/app/(tenant)/admin/(panels)/render-panel";

export default async function AdminWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const section = parseAdminSection(params.section);
  return renderAdminPanel(section, params);
}
