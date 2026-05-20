import { parseAdminSection } from "@/lib/admin-sections";
import { renderAdminPanel } from "@/app/(tenant)/admin/(panels)/render-panel";

export default async function AdminWorkspacePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const section = parseAdminSection(searchParams?.section);
  return renderAdminPanel(section, searchParams);
}
