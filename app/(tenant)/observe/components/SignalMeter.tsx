import styles from "./flow.module.css";

const LEVEL: Record<string, number> = { LIMITED: 1, SOME: 2, CONSISTENT: 3, STRONG: 4 };

/** Four short bars: how strong the evidence was. Amber for the lower two levels. */
export function SignalMeter({ level, valueKey }: { level?: number; valueKey?: string | null }) {
  const n = level ?? (valueKey ? LEVEL[valueKey] ?? 0 : 0);
  return (
    <span className={styles.meter} data-tone={n > 0 && n <= 2 ? "low" : undefined} aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <i key={i} data-on={i <= n ? "" : undefined} />
      ))}
    </span>
  );
}

const SHORT: Record<string, string> = { LIMITED: "Limited", SOME: "Some", CONSISTENT: "Consistent", STRONG: "Strong" };

/** Short rating names for tight rows; the full scale label is used where there is room. */
export function shortScaleLabel(valueKey: string | null | undefined): string {
  return valueKey ? SHORT[valueKey] ?? valueKey : "";
}
