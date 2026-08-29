import type { ReactNode } from "react";

/** Single-weight stroke icons — uniform 18×18, no filled shapes, no PRIMARY/secondary stacks. */
const S = {
  className: "h-[18px] w-[18px] shrink-0",
  stroke: "currentColor" as const,
  fill: "none" as const,
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={S.className} fill={S.fill} stroke={S.stroke} strokeWidth={S.strokeWidth} strokeLinecap={S.strokeLinecap} strokeLinejoin={S.strokeLinejoin}>
      {children}
    </svg>
  );
}

function UserIcon() {
  return (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  );
}

function UsersIcon() {
  return (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

function BarsIcon() {
  return (
    <Icon>
      <path d="M4 18V10M12 18V6M20 18v-8" />
    </Icon>
  );
}

function DoorIcon() {
  return (
    <Icon>
      <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 12h.01" strokeWidth={2.25} />
    </Icon>
  );
}

function BookmarkIcon() {
  return (
    <Icon>
      <path d="M7 4h10v16l-5-3.5L7 20V4z" />
    </Icon>
  );
}

function BagIcon() {
  return (
    <Icon>
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      <path d="M6 8h12l-1 12H7L6 8z" />
    </Icon>
  );
}

function BulbIcon() {
  return (
    <Icon>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a5 5 0 0 0-2 9.5V15h4v-2.5A5 5 0 0 0 12 3z" />
    </Icon>
  );
}

function LayersIcon() {
  return (
    <Icon>
      <path d="M12 4 4 8l8 4 8-4-8-4z" />
      <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
    </Icon>
  );
}

function BookIcon() {
  return (
    <Icon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  );
}

function MessageIcon() {
  return (
    <Icon>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

function TrendIcon() {
  return (
    <Icon>
      <path d="M23 6 13.5 15.5 9 11 1 19" />
      <path d="M17 6h6v6" />
    </Icon>
  );
}

function RefreshIcon() {
  return (
    <Icon>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Icon>
  );
}

function PulseIcon() {
  return (
    <Icon>
      <path d="M22 12h-4l-2.5 8L9 4 6.5 12H2" />
    </Icon>
  );
}

function AlertIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </Icon>
  );
}

function ClipboardIcon() {
  return (
    <Icon>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

function UserCheckIcon() {
  return (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m19 8 2 2 3-3" />
    </Icon>
  );
}

function MoveIcon() {
  return (
    <Icon>
      <path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l3-3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
    </Icon>
  );
}

function VolumeOffIcon() {
  return (
    <Icon>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </Icon>
  );
}

function ScreenIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Icon>
  );
}

function CheckSquareIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 11 12 14 22 4" />
    </Icon>
  );
}

function BoltIcon() {
  return (
    <Icon>
      <path d="M13 2 3 14h7l-1 8 11-12h-7l1-8z" />
    </Icon>
  );
}

function MicIcon() {
  return (
    <Icon>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v2M9 22h6" />
    </Icon>
  );
}

function GridIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  );
}

const ICON_BY_BASE: Record<string, () => ReactNode> = {
  BEHAVIOUR_CLIMATE: () => <UserIcon />,
  PACE_MOMENTUM: () => <BarsIcon />,
  ENTRY_ROUTINE: () => <DoorIcon />,
  RETRIEVAL_TASK_QUALITY: () => <BagIcon />,
  RETRIEVAL_CHECK: () => <BookmarkIcon />,
  EXPLANATION_CLARITY: () => <BulbIcon />,
  MODELLING_EXPLICITNESS: () => <LayersIcon />,
  MODELLING_ON_DEMAND: () => <LayersIcon />,
  VOCABULARY_PRECISION: () => <BookIcon />,
  DIRECTED_QUESTIONING: () => <MessageIcon />,
  STRETCH_IN_ROOM: () => <TrendIcon />,
  CFU_CYCLES: () => <RefreshIcon />,
  RESPONSIVE_ADJUSTMENT: () => <PulseIcon />,
  ERROR_CORRECTION_PRECISION: () => <AlertIcon />,
  PARTICIPATION_EQUITY_GP: () => <UsersIcon />,
  TASK_CLARITY: () => <ClipboardIcon />,
  INDEPENDENT_ACCOUNTABILITY_IP: () => <UserCheckIcon />,
  CIRCULATION_FEEDBACK: () => <MoveIcon />,
  STRETCH_DEPLOYMENT_IP: () => <TrendIcon />,
  SILENCE_AND_FOCUS: () => <VolumeOffIcon />,
  PRESENTATION_STANDARD: () => <ScreenIcon />,
  WORK_COMPLETION: () => <CheckSquareIcon />,
  SUSTAINED_EFFORT: () => <BoltIcon />,
  TASK_APPROPRIATENESS: () => <ClipboardIcon />,
  VOLUME_OF_WORK: () => <BarsIcon />,
  PHONICS_VOCABULARY_PRECISION: () => <BookIcon />,
  ORACY_GUIDED: () => <MicIcon />,
  ORACY_INDEPENDENT: () => <MicIcon />,
};

function baseKeyFromCatalogKey(signalKey: string): string {
  return signalKey.startsWith("PRIMARY_") ? signalKey.slice("PRIMARY_".length) : signalKey;
}

/** One minimal line icon per row; primary curriculum keys use the same icon as their base (no star stack). */
export function SignalKeyIcon({ signalKey }: { signalKey: string }) {
  const base = baseKeyFromCatalogKey(signalKey);
  const node = (ICON_BY_BASE[base] ?? (() => <GridIcon />))();
  return (
    <span className="inline-flex shrink-0 items-center justify-center text-[#7C5CFF]" aria-hidden>
      {node}
    </span>
  );
}
