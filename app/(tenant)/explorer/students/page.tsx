import { redirect } from "next/navigation";
import { migrateInsightsUrl, type LegacyQuery } from "@/lib/insights-navigation";
export default async function LegacyPage({searchParams}:{searchParams:Promise<LegacyQuery>}) {
  redirect(migrateInsightsUrl("/explorer/students", await searchParams));
}
