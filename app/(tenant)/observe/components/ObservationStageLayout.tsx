import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import styles from "./flow.module.css";

const STEPS = ["Lesson", "Signals", "Review"] as const;

/** Shared shell for the three steps of a new observation. */
export function ObservationStageLayout({
  currentStep,
  subtitle,
  children,
  wide = false,
}: {
  currentStep: 1 | 2 | 3;
  subtitle?: ReactNode;
  children: ReactNode;
  /** The review step uses a two-column layout. */
  wide?: boolean;
}) {
  return (
    <div className={`${styles.page} mx-auto w-full pb-16 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <PageHeader
        title="New observation"
        subtitle={subtitle}
        eyebrow={
          <Breadcrumb items={[{ label: "Observations", href: "/observe/history" }, { label: "New observation" }]} />
        }
      />
      <ol className={`${styles.steps} mt-6`} aria-label={`Step ${currentStep} of 3`}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < currentStep ? "done" : n === currentStep ? "current" : "todo";
          return (
            <li key={label} className={styles.step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span>
                {n}. {label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-6">{children}</div>
    </div>
  );
}
