import { SIGNAL_DEFINITIONS, type ScaleKey, type SignalKey } from "@/modules/observations/signalDefinitions";
import { PRIMARY_SIGNAL_DEFINITIONS } from "@/modules/observations/signalDefinitionsPrimary";

const defByKey = new Map<SignalKey, (typeof SIGNAL_DEFINITIONS)[number]>(
  [...SIGNAL_DEFINITIONS, ...PRIMARY_SIGNAL_DEFINITIONS].map((d) => [d.key, d]),
);

export function pedagogicalSignalTooltip(signalKey: string, valueKey: string | null | undefined): string {
  const def = defByKey.get(signalKey as SignalKey);
  const name = def?.displayNameDefault ?? signalKey;
  if (!valueKey) return name;
  const scaleEntry = def?.scale.find((s) => s.key === valueKey);
  const levelLabel = scaleEntry?.label ?? valueKey;
  const guidance =
    def?.scaleGuidance && valueKey in def.scaleGuidance
      ? def.scaleGuidance[valueKey as ScaleKey]
      : scaleEntry?.description ?? "";
  return guidance ? `${name} — ${levelLabel}: ${guidance}` : `${name} — ${levelLabel}`;
}
