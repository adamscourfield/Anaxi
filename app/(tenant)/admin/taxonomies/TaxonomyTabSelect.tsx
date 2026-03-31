"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function TaxonomyTabSelect({
  tabs,
  current,
  labels,
}: {
  tabs: readonly string[];
  current: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="md:hidden">
      <label htmlFor="taxonomy-tab" className="mb-1.5 block text-sm font-medium text-text">
        Section
      </label>
      <select
        id="taxonomy-tab"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => router.push(`/admin/taxonomies?tab=${next}`));
        }}
        className="w-full rounded-xl border border-border bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-text shadow-ambient focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
      >
        {tabs.map((t) => (
          <option key={t} value={t}>
            {labels[t]}
          </option>
        ))}
      </select>
    </div>
  );
}
