import type { ReactNode } from "react";

const STROKE = { stroke: "currentColor", fill: "none" as const, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function TwoPeopleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" fill="currentColor" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M4 20V10M12 20V4M20 20v-6" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DoorIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <rect x="5" y="2" width="14" height="20" rx="1" />
      <path d="M15 12h.01" strokeWidth="2.5" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M4 22V4a1 1 0 011-1h12l-2 4 2 4H5" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M4 4.5A2.5 2.5 0 016.5 7H20" />
      <path d="M6.5 7H20v10H6.5A2.5 2.5 0 014 14.5v-7A2.5 2.5 0 016.5 5" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M9 18h6M10 22h4M12 2a6 6 0 00-3 11.1V16h6v-2.9A6 6 0 0012 2z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </svg>
  );
}

function RefreshCycleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8l2 2 4-4" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l3-3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
    </svg>
  );
}

function VolumeXIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function CheckSquareIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M12 14a4 4 0 004-4V5a4 4 0 00-8 0v5a4 4 0 004 4z" />
      <path d="M19 10v1a7 7 0 01-14 0v-1M12 19v3M8 22h8" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M9 12l-1.5 4.5L3 18l4.5 1.5L9 24l1.5-4.5L15 18l-4.5-1.5L9 12zM16 4l-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3z" />
    </svg>
  );
}

const ICON_BY_BASE: Record<string, () => ReactNode> = {
  BEHAVIOUR_CLIMATE: () => <TwoPeopleIcon />,
  PACE_MOMENTUM: () => <BarChartIcon />,
  ENTRY_ROUTINE: () => <DoorIcon />,
  RETRIEVAL_TASK_QUALITY: () => <BagIcon />,
  RETRIEVAL_CHECK: () => <BookmarkIcon />,
  EXPLANATION_CLARITY: () => <LightbulbIcon />,
  MODELLING_EXPLICITNESS: () => <LayersIcon />,
  MODELLING_ON_DEMAND: () => <LayersIcon />,
  VOCABULARY_PRECISION: () => <BookOpenIcon />,
  DIRECTED_QUESTIONING: () => <MessageIcon />,
  STRETCH_IN_ROOM: () => <TrendingUpIcon />,
  CFU_CYCLES: () => <RefreshCycleIcon />,
  RESPONSIVE_ADJUSTMENT: () => <ActivityIcon />,
  ERROR_CORRECTION_PRECISION: () => <AlertCircleIcon />,
  ERROR_CORRECTION_DEPTH: () => <AlertCircleIcon />,
  PARTICIPATION_EQUITY_GP: () => <UsersIcon />,
  PARTICIPATION_EQUITY: () => <UsersIcon />,
  TASK_CLARITY: () => <ClipboardIcon />,
  INDEPENDENT_ACCOUNTABILITY_IP: () => <UserCheckIcon />,
  INDEPENDENT_ACCOUNTABILITY: () => <UserCheckIcon />,
  CIRCULATION_FEEDBACK: () => <MoveIcon />,
  STRETCH_DEPLOYMENT_IP: () => <TrendingUpIcon />,
  STRETCH_DEPLOYMENT: () => <TrendingUpIcon />,
  SILENCE_AND_FOCUS: () => <VolumeXIcon />,
  PRESENTATION_STANDARD: () => <MonitorIcon />,
  WORK_COMPLETION: () => <CheckSquareIcon />,
  SUSTAINED_EFFORT: () => <ZapIcon />,
  TASK_APPROPRIATENESS: () => <ClipboardIcon />,
  VOLUME_OF_WORK: () => <BarChartIcon />,
  COLD_CALL_DENSITY: () => <MessageIcon />,
  LANGUAGE_PRECISION: () => <BookOpenIcon />,
  LIVE_ADJUSTMENT: () => <ActivityIcon />,
  RETRIEVAL_PRESENCE: () => <BookmarkIcon />,
  PHONICS_VOCABULARY_PRECISION: () => <BookOpenIcon />,
  ORACY_GUIDED: () => <MicIcon />,
  ORACY_INDEPENDENT: () => <MicIcon />,
};

function iconForKey(signalKey: string): ReactNode {
  const isPrimary = signalKey.startsWith("PRIMARY_");
  const base = isPrimary ? signalKey.slice("PRIMARY_".length) : signalKey;
  const main = (ICON_BY_BASE[base] ?? (() => <SparklesIcon />))();

  if (!isPrimary) {
    return main;
  }

  if (base === "PACE_MOMENTUM") {
    return (
      <span className="inline-flex items-center gap-1.5" aria-hidden>
        <span className="text-[#7C69EF] dark:text-violet-400">
          <TargetIcon />
        </span>
        <span className="text-[#7C69EF]/90 dark:text-violet-400/90">
          <StarIcon />
        </span>
      </span>
    );
  }
  if (base === "ENTRY_ROUTINE") {
    return (
      <span className="inline-flex items-center gap-1.5" aria-hidden>
        <span className="text-[#7C69EF] dark:text-violet-400">
          <FlagIcon />
        </span>
        <span className="text-[#7C69EF]/90 dark:text-violet-400/90">
          <StarIcon />
        </span>
      </span>
    );
  }
  if (base === "RETRIEVAL_TASK_QUALITY") {
    return (
      <span className="inline-flex items-center gap-1.5" aria-hidden>
        <span className="text-[#7C69EF] dark:text-violet-400">
          <BookmarkIcon />
        </span>
        <span className="text-[#7C69EF]/90 dark:text-violet-400/90">
          <StarIcon />
        </span>
      </span>
    );
  }

  const match = base.match(/^(BEHAVIOUR_CLIMATE|RETRIEVAL_CHECK)$/);
  if (match) {
    const pair: Record<string, ReactNode> = {
      BEHAVIOUR_CLIMATE: <TwoPeopleIcon />,
      RETRIEVAL_CHECK: <BookmarkIcon />,
    };
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[#7C69EF] dark:text-violet-400" aria-hidden>
          {pair[match[1]]}
        </span>
        <span className="text-[#7C69EF]/90 dark:text-violet-400/90" aria-hidden>
          <StarIcon />
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" title="Primary signal">
      <span className="text-[#7C69EF] dark:text-violet-400">{main}</span>
      <span className="text-[#7C69EF]/85 dark:text-violet-400/85">
        <StarIcon />
      </span>
    </span>
  );
}

/** Distinct purple-tinted icon per catalog row; primary curriculum pairs use star + base motif where relevant. */
export function SignalKeyIcon({ signalKey }: { signalKey: string }) {
  return <span className="inline-flex shrink-0 items-center justify-center">{iconForKey(signalKey)}</span>;
}
