import Link from "next/link";
import type { RiskBand } from "@/modules/analysis/studentRisk";
import {
  BAND_LABELS,
  BAND_ORDER,
  buildStudentsListUrl,
  type StudentsUrlParams,
} from "@/modules/students/explorerList";

const CHIP_ACTIVE: Record<RiskBand, string> = {
  URGENT:
    "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)] ring-2 ring-[var(--pill-error-ring)]",
  PRIORITY:
    "bg-[color-mix(in_srgb,var(--scale-limited-light)_88%,transparent)] text-[var(--scale-limited-text)] ring-2 ring-[color-mix(in_srgb,var(--scale-limited-bar)_35%,transparent)]",
  WATCH:
    "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)] ring-2 ring-[var(--pill-warning-ring)]",
  STABLE:
    "bg-[var(--pill-success-bg)] text-[var(--pill-success-text)] ring-2 ring-[var(--pill-success-ring)]",
};

const CHIP_IDLE =
  "bg-surface-container-low text-muted ring-1 ring-inset ring-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] hover:bg-surface-container-high hover:text-text";

type Props = {
  basePath: string;
  urlBase: StudentsUrlParams;
  bandCounts: Record<RiskBand, number>;
  activeBand: string;
  activeView: string;
};

export function StudentsBandChips({
  basePath,
  urlBase,
  bandCounts,
  activeBand,
  activeView,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by risk band">
      {BAND_ORDER.map((band) => {
        const isActive = activeBand === band;
        const href = buildStudentsListUrl(basePath, {
          ...urlBase,
          view: band === "WATCH" || band === "STABLE" ? band.toLowerCase() as "watch" | "stable" : "all",
          band,
          page: undefined,
        });
        return (
          <Link
            key={band}
            href={href}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold calm-transition ${isActive ? CHIP_ACTIVE[band] : CHIP_IDLE}`}
          >
            {BAND_LABELS[band]}
            <span className="tabular-nums opacity-90">{bandCounts[band]}</span>
          </Link>
        );
      })}
      <Link
        href={buildStudentsListUrl(basePath, {
          ...urlBase,
          view: "attention",
          band: undefined,
          page: undefined,
        })}
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold calm-transition ${
          activeView === "attention" && !activeBand
            ? "bg-accent text-on-primary ring-2 ring-accent"
            : CHIP_IDLE
        }`}
      >
        Needs attention
        <span className="tabular-nums opacity-90">
          {bandCounts.URGENT + bandCounts.PRIORITY}
        </span>
      </Link>
    </div>
  );
}
