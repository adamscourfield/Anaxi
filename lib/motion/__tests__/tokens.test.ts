import { describe, expect, it } from "vitest";
import {
  MOTION_EASE_FRAMER,
  MOTION_MS_PANEL,
  MOTION_PANEL_SEC,
  motionRootCssProperties,
} from "@/lib/motion/tokens";

describe("motion tokens", () => {
  it("keeps Framer panel duration aligned with panel milliseconds", () => {
    expect(MOTION_PANEL_SEC).toBe(MOTION_MS_PANEL / 1000);
  });

  it("uses a standard cubic-bezier tuple for Framer", () => {
    expect(MOTION_EASE_FRAMER).toEqual([0.22, 1, 0.36, 1]);
  });

  it("exposes CSS variables for the root layout injector", () => {
    const style = motionRootCssProperties() as Record<string, string>;
    expect(style["--motion-ease-hvqt"]).toContain("cubic-bezier");
    expect(style["--motion-duration-panel"]).toBe("300ms");
    expect(style["--motion-duration-micro"]).toBe("200ms");
  });
});
