import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");

  const params = await searchParams;

  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  const yearGroup = Array.isArray(params.yearGroup) ? params.yearGroup[0] : params.yearGroup;
  const band = Array.isArray(params.band) ? params.band[0] : params.band;
  const page = Array.isArray(params.page) ? params.page[0] : params.page;

  const mapped = new URLSearchParams();
  if (q) mapped.set("studentSearch", q);
  if (yearGroup) mapped.set("yearGroup", yearGroup);
  if (band) mapped.set("band", band);
  if (page) mapped.set("page", page);

  const qs = mapped.toString();
  redirect(`/explorer/students${qs ? `?${qs}` : ""}`);
}
