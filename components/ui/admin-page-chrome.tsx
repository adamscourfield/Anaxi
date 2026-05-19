import type { ReactNode } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";

/** Consistent admin section header with breadcrumb (UX-025). */
export function AdminPageChrome({
  area,
  title,
  subtitle,
  actions,
  meta,
}: {
  area: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <PageHeader
      variant="ledger"
      title={title}
      subtitle={subtitle}
      actions={actions}
      meta={meta}
      eyebrow={
        <Breadcrumb
          items={[
            { label: "Administration", href: "/admin" },
            { label: area },
          ]}
        />
      }
    />
  );
}

export function AdminDashboardLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/admin" className={`link-subtle text-sm text-muted hover:text-text ${className}`.trim()}>
      ← Administration dashboard
    </Link>
  );
}
