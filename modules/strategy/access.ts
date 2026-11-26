/** Who can see the Strategy Board, and who can change it. One list, used by the nav, page and actions. */
const VIEW_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "SLT"]);
const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "SLT"]);

export function canViewStrategy(role: string): boolean {
  return VIEW_ROLES.has(role);
}

export function canManageStrategy(role: string): boolean {
  return MANAGE_ROLES.has(role);
}

export const STRATEGY_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type StrategyPriority = (typeof STRATEGY_PRIORITIES)[number];

export function parseStrategyPriority(value: unknown, fallback: StrategyPriority = "medium"): StrategyPriority {
  return STRATEGY_PRIORITIES.includes(value as StrategyPriority) ? (value as StrategyPriority) : fallback;
}

export const STRATEGY_LIMITS = { title: 80, target: 40, lead: 60, description: 1000, action: 200 } as const;
