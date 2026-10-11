"use client";

import Link from "next/link";
import { useTenantUiOptional } from "@/components/tenant-ui-context";
import { Button } from "@/components/ui/button";

const EXPLORER_ROLES = new Set(["ADMIN", "SLT", "HOD", "SUPER_ADMIN"]);

type Props = {
  cycleId?: string;
  className?: string;
};

/** Link to Explorer assessment hub when ANALYSIS is on and role allows. */
export function AttainmentExplorerLink({ cycleId, className = "" }: Props) {
  const ui = useTenantUiOptional();
  if (!ui) return null;
  if (!ui.enabledFeatures.includes("ANALYSIS")) return null;
  if (!EXPLORER_ROLES.has(ui.role)) return null;

  const href = cycleId
    ? `/insights/attainment?cycle=${encodeURIComponent(cycleId)}`
    : "/insights/attainment";

  return (
    <Button asChild variant="secondary" className={className}>
      <Link href={href}>Attainment insights</Link>
    </Button>
  );
}
