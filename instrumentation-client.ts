/**
 * Runs in the browser before the app hydrates (Next.js client instrumentation).
 *
 * Next calls `onRouterTransitionStart` at the start of every app-router
 * navigation: <Link> clicks, router.push / router.replace, and back/forward.
 * We re-broadcast it as a DOM event so <NavigationProgress> can show the page
 * loading indicator without every caller having to opt in.
 */
import { NAVIGATION_START_EVENT, type NavigationStartDetail } from "@/lib/navigation-events";

export function onRouterTransitionStart(url: string, navigationType: NavigationStartDetail["navigationType"]) {
  window.dispatchEvent(new CustomEvent<NavigationStartDetail>(NAVIGATION_START_EVENT, { detail: { url, navigationType } }));
}
