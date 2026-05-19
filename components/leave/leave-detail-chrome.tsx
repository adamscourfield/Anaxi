"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

export function LeaveDetailChrome({
  title,
  statusBadge,
  backHref,
  backLabel,
  children,
  approvalBar,
}: {
  title: string;
  statusBadge: ReactNode;
  backHref: string;
  backLabel: string;
  children: ReactNode;
  approvalBar?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 md:pb-8">
      <PageHeader
        variant="ledger"
        title={title}
        eyebrow={
          <Breadcrumb
            items={[
              { label: "Leave", href: "/leave" },
              { label: "Request detail" },
            ]}
          />
        }
        meta={statusBadge}
        actions={
          <Button variant="secondary" asChild>
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        }
      />
      {children}
      {approvalBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)]/95 p-4 backdrop-blur-sm md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          {approvalBar}
        </div>
      ) : null}
    </div>
  );
}
