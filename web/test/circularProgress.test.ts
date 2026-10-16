import { describe, expect, test } from "bun:test";
import { colorForPercent } from "../src/components/ui/circular-progress-color";

// Thresholds mirror CONTEXT_COMPACT_RATIO (0.6) / CONTEXT_SUMMARIZE_RATIO
// (0.75) in server/src/worker/agent/config.ts — the color band change must
// line up with when auto-compaction/auto-summarization actually fire.
describe("colorForPercent", () => {
  test("blue below the compact threshold", () => {
    expect(colorForPercent(0)).toBe("text-blue-500");
    expect(colorForPercent(59.9)).toBe("text-blue-500");
  });

  test("orange between the compact and summarize thresholds", () => {
    expect(colorForPercent(60)).toBe("text-orange-400");
    expect(colorForPercent(74.9)).toBe("text-orange-400");
  });

  test("red at and above the summarize threshold", () => {
    expect(colorForPercent(75)).toBe("text-red-400");
    expect(colorForPercent(100)).toBe("text-red-400");
  });
});
