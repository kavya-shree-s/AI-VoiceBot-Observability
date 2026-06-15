import { describe, it, expect } from "vitest";
import { generateInsights } from "./insights";
import type { PerformanceData } from "./types";

const base = (
  overrides: Partial<PerformanceData["results"]> = {}
): PerformanceData["results"] => ({
  total_calls: 525,
  success_rate: 100,
  answer_rate: 100,
  failure_rate: 0,
  average_duration: 90,
  total_cost: null,
  cost_per_success: null,
  call_breakdown: { picked: 525, no_answer: 0, busy: 0, failed: 0 },
  outcome_distribution: {
    RESOLVED: { count: 99, percentage: 18.86 },
    TRANSFERRED: { count: 143, percentage: 27.24 },
    NOT_BLOCKED: { count: 100, percentage: 19.05 },
    TEST_RIDE_REQUESTED: { count: 53, percentage: 10.1 },
    TEST_RIDE_SUCCESS: { count: 32, percentage: 6.1 },
  },
  ...overrides,
});

describe("generateInsights", () => {
  it("includes the top outcome", () => {
    const ins = generateInsights(base());
    expect(ins.some((i) => i.kind === "topOutcome" && i.headline.includes("TRANSFERRED"))).toBe(true);
  });

  it("compares resolution rate against prior period", () => {
    const cur = base({
      outcome_distribution: {
        RESOLVED: { count: 110, percentage: 22 },
        TRANSFERRED: { count: 130, percentage: 26 },
      },
    });
    const prior = base({
      outcome_distribution: {
        RESOLVED: { count: 90, percentage: 18 },
        TRANSFERRED: { count: 135, percentage: 27 },
      },
    });
    const ins = generateInsights(cur, prior);
    const res = ins.find((i) => i.kind === "resolutionDelta");
    expect(res).toBeDefined();
    expect(res!.direction).toBe("up");
    expect(res!.headline.toLowerCase()).toMatch(/resolution/);
    expect(res!.headline).toMatch(/4(\.0)?(\s*pp)?/);
  });

  it("uses a neutrality band below 1pp", () => {
    const cur = base({
      outcome_distribution: { RESOLVED: { count: 50, percentage: 18.4 } },
    });
    const prior = base({
      outcome_distribution: { RESOLVED: { count: 50, percentage: 18 } },
    });
    const ins = generateInsights(cur, prior);
    expect(ins.find((i) => i.kind === "resolutionDelta")).toBeUndefined();
  });

  it("flags a significant shift (>5pp) for an outcome", () => {
    const cur = base({
      outcome_distribution: { BUSY: { count: 50, percentage: 12 } },
    });
    const prior = base({
      outcome_distribution: { BUSY: { count: 20, percentage: 4 } },
    });
    const ins = generateInsights(cur, prior);
    expect(
      ins.some((i) => i.kind === "significantShift" && i.headline.includes("BUSY"))
    ).toBe(true);
  });

  it("works without prior data (single-period mode)", () => {
    const ins = generateInsights(base());
    expect(ins.length).toBeGreaterThan(0);
    expect(ins.every((i) => i.kind !== "resolutionDelta")).toBe(true);
  });
});
