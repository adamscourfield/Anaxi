"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";

const STEPS = [
  "School settings",
  "Enable modules",
  "Upload staff",
  "Behaviour labels",
  "Signal labels",
  "Timetable (optional)",
  "Finish",
] as const;

export default function OnboardingWizardClient({
  stepIndex,
  children,
}: {
  stepIndex: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        variant="ledger"
        eyebrow="Administration › Onboarding"
        title="School onboarding"
        subtitle={`Step ${stepIndex + 1} of ${STEPS.length}`}
      />

      {/* Step indicator */}
      <ol className="flex gap-1.5 overflow-x-auto text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`calm-transition flex-1 rounded-lg px-2 py-1.5 text-center font-medium ${
              i === stepIndex
                ? "border border-accent/20 bg-[var(--accent-tint)] text-text anx-card-elevated"
                : i < stepIndex
                ? "bg-accent/10 text-accent"
                : "bg-surface/60 text-muted"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div>{children}</div>
    </div>
  );
}
