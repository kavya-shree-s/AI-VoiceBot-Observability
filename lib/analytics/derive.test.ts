import { describe, it, expect } from "vitest";
import { deriveKpis } from "./derive";
import type { PerformanceData } from "./types";

const make = (
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

describe("deriveKpis", () => {
  it("pulls headline counts straight from the performance payload", () => {
    const kpis = deriveKpis(make());
    expect(kpis.totalCalls).toBe(525);
    expect(kpis.resolvedCalls).toBe(99);
    expect(kpis.transferredCalls).toBe(143);
  });

  it("uses the API's percentages for resolution and transfer rates", () => {
    const kpis = deriveKpis(make());
    expect(kpis.resolutionRate).toBe(18.86);
    expect(kpis.transferRate).toBe(27.24);
  });

  it("computes test-ride success rate as SUCCESS / REQUESTED * 100", () => {
    const kpis = deriveKpis(make());
    // 32 / 53 * 100 = 60.377...
    expect(kpis.testRideSuccessRate).toBeCloseTo(60.38, 2);
  });

  it("returns 0 for test-ride success rate when no rides were requested", () => {
    const kpis = deriveKpis(
      make({
        outcome_distribution: {
          RESOLVED: { count: 10, percentage: 100 },
        },
      })
    );
    expect(kpis.testRideSuccessRate).toBe(0);
  });

  it("treats missing outcomes as zero rather than NaN", () => {
    const kpis = deriveKpis(
      make({
        outcome_distribution: {},
      })
    );
    expect(kpis.resolvedCalls).toBe(0);
    expect(kpis.transferredCalls).toBe(0);
    expect(kpis.resolutionRate).toBe(0);
    expect(kpis.transferRate).toBe(0);
  });
});
