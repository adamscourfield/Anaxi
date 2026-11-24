/** DOM event fired (by instrumentation-client.ts) when an app-router navigation starts. */
export const NAVIGATION_START_EVENT = "anaxi:navigation-start";

export type NavigationStartDetail = { url: string; navigationType: "push" | "replace" | "traverse" };
