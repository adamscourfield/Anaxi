import { describe, expect, it } from "vitest";
import { meanToHeatmapBarClass, signalHeatmapCellTitle } from "../signalHeatmap";

describe("meanToHeatmapBarClass", () => {
  it("returns distinct classes for each rubric band", () => {
    const noData = meanToHeatmapBarClass(null);
    const low = meanToHeatmapBarClass(1.0);
    const mid = meanToHeatmapBarClass(2.0);
    const good = meanToHeatmapBarClass(3.0);
    const strong = meanToHeatmapBarClass(3.6);

    const set = new Set([noData, low, mid, good, strong]);
    expect(set.size).toBe(5);
  });

  it("uses boundary thresholds consistently", () => {
    expect(meanToHeatmapBarClass(1.49)).toBe(meanToHeatmapBarClass(1.0));
    expect(meanToHeatmapBarClass(1.5)).toBe(meanToHeatmapBarClass(2.0));
    expect(meanToHeatmapBarClass(2.49)).toBe(meanToHeatmapBarClass(2.0));
    expect(meanToHeatmapBarClass(2.5)).toBe(meanToHeatmapBarClass(3.0));
    expect(meanToHeatmapBarClass(3.49)).toBe(meanToHeatmapBarClass(3.0));
    expect(meanToHeatmapBarClass(3.5)).toBe(meanToHeatmapBarClass(4.0));
  });
});

describe("signalHeatmapCellTitle", () => {
  it("includes scale hint when mean is present", () => {
    expect(signalHeatmapCellTitle("Pace", 2.25)).toContain("2.25");
    expect(signalHeatmapCellTitle("Pace", 2.25)).toContain("higher is stronger");
  });

  it("handles missing mean", () => {
    expect(signalHeatmapCellTitle("Pace", null)).toBe("Pace: No data");
  });
});
