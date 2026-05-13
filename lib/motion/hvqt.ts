import { MOTION_PANEL_SEC } from "@/lib/motion/tokens";

/** Panel / route duration in seconds (matches `var(--motion-duration-panel)`). */
export const HVQT_DURATION_SEC = MOTION_PANEL_SEC;

/**
 * CSS classes for snap-to-focus motion (see `app/globals.css`).
 * Formerly driven by framer-motion variants on the same timing curve.
 */
export const hvqtPageEnterClass = "hvqt-page-surface-enter";
export const hvqtPageExitClass = "hvqt-page-surface-exit";
export const hvqtMotionSurfaceRouteClass = "hvqt-motion-surface-route";
export const hvqtMotionSurfacePanelClass = "hvqt-motion-surface-panel";
