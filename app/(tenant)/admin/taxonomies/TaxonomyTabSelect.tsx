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
      <label htmlFor="taxonomy-tab" className="mb-1.5 block text-sm font-medium text-[var(--on-surface)]">
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
        className="w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm font-medium text-[var(--on-surface)] shadow-sm outline-none transition focus:border-[#93C5FD] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)] disabled:opacity-60"
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
