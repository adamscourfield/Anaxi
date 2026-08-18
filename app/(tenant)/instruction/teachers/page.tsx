import { redirect } from "next/navigation";

/**
 * Teachers now lives at /explorer/teachers (same page, same access rules).
 * This route just forwards old links/bookmarks, preserving query params.
 */
export default async function InstructionTeachersRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === "string") qs.set(key, v);
  }
  const qsString = qs.toString();
  redirect(`/explorer/teachers${qsString ? `?${qsString}` : ""}`);
}
