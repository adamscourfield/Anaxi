import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { buildTenantFeatureList } from "@/lib/admin-feature-list";
import { AdminFeatureFlags } from "@/components/admin/admin-feature-flags";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";
import { toggleTenantFeature } from "@/app/(tenant)/admin/features/actions";

export default async function AdminFeaturesPage() {
  const user = await requireAdminUser();
  const rows = await prisma.tenantFeature.findMany({
    where: { tenantId: user.tenantId },
    select: { key: true, enabled: true },
    orderBy: { key: "asc" },
  });
  const features = buildTenantFeatureList(rows);

  return (
    <div className="space-y-8 pb-8">
      <AdminPageChrome
        area="Feature flags"
        title="Module availability"
        subtitle="Enable or disable product modules for this school. Changes apply tenant-wide."
        meta={
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3.5 py-2 text-[0.8125rem] font-semibold text-[var(--on-surface)] shadow-sm calm-transition hover:bg-[var(--surface-container-low)]"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-[var(--on-surface-variant)]" aria-hidden>
              <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to administration
          </Link>
        }
      />
      <AdminFeatureFlags features={features} toggleFeature={toggleTenantFeature} />
    </div>
  );
}
