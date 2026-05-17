export const VALID_WINDOWS = [7, 21, 28, 90] as const;
export type WindowDays = (typeof VALID_WINDOWS)[number];

export function parseWindow(raw: string | undefined): WindowDays {
  const n = Number(raw);
  return VALID_WINDOWS.includes(n as WindowDays) ? (n as WindowDays) : 21;
}
