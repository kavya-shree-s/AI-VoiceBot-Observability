import { describe, it, expect } from "vitest";
import {
  mergePerformance,
  mergeOutcomeCounts,
  mergeCallBased,
} from "./merge";
import type {
  PerformanceData,
  OutcomeCountsData,
  CallBasedData,
} from "./types";

const perf = (
  total: number,
  outcomes: Record<string, number>
): PerformanceData => {
  const dist: Record<string, { count: number; percentage: number }> = {};
  for (const [k, c] of Object.entries(outcomes)) {
    dist[k] = { count: c, percentage: total > 0 ? (c / total) * 100 : 0 };
  }
  return {
    type: "performance",
    filters_applied: {},
    results: {
      total_calls: total,
      success_rate: 100,
      answer_rate: 100,
      failure_rate: 0,
      average_duration: 90,
      total_cost: null,
      cost_per_success: null,
      call_breakdown: { picked: total, no_answer: 0, busy: 0, failed: 0 },
      outcome_distribution: dist,
    },
  };
};

describe("mergePerformance", () => {
  it("sums totals and outcome counts; recomputes percentages on the union", () => {
    const a = perf(100, { RESOLVED: 60, BUSY: 40 });
    const b = perf(200, { RESOLVED: 80, TRANSFERRED: 120 });
    const m = mergePerformance([a, b]);
    expect(m.results.total_calls).toBe(300);
    expect(m.results.outcome_distribution.RESOLVED.count).toBe(140);
    expect(m.results.outcome_distribution.BUSY.count).toBe(40);
    expect(m.results.outcome_distribution.TRANSFERRED.count).toBe(120);
    expect(m.results.outcome_distribution.RESOLVED.percentage).toBeCloseTo(
      (140 / 300) * 100,
      4
    );
  });

  it("weights average_duration by total_calls", () => {
    const a = { ...perf(100, {}), results: { ...perf(100, {}).results, average_duration: 60 } };
    const b = { ...perf(300, {}), results: { ...perf(300, {}).results, average_duration: 80 } };
    const m = mergePerformance([a, b]);
    expect(m.results.average_duration).toBeCloseTo((60 * 100 + 80 * 300) / 400, 4);
  });

  it("returns an empty zeroed shape when given no parts", () => {
    const m = mergePerformance([]);
    expect(m.results.total_calls).toBe(0);
    expect(Object.keys(m.results.outcome_distribution)).toHaveLength(0);
  });
});

describe("mergeOutcomeCounts", () => {
  const make = (
    page_total: number,
    results: Array<{ outcome: string; count: number }>
  ): OutcomeCountsData => ({
    type: "outcome-counts",
    filters_applied: {},
    pagination: { page: 1, limit: 100, total: results.length, total_pages: 1 },
    results: results.map((r) => ({
      ...r,
      percentage: page_total > 0 ? (r.count / page_total) * 100 : 0,
    })),
    page_total_calls: page_total,
  });

  it("sums counts per outcome and recomputes percentages on the merged total", () => {
    const a = make(100, [
      { outcome: "RESOLVED", count: 60 },
      { outcome: "BUSY", count: 40 },
    ]);
    const b = make(200, [
      { outcome: "RESOLVED", count: 80 },
      { outcome: "TRANSFERRED", count: 120 },
    ]);
    const m = mergeOutcomeCounts([a, b]);
    expect(m.page_total_calls).toBe(300);
    const byName = Object.fromEntries(m.results.map((r) => [r.outcome, r]));
    expect(byName.RESOLVED.count).toBe(140);
    expect(byName.RESOLVED.percentage).toBeCloseTo((140 / 300) * 100, 4);
  });

  it("sorts the merged result by count descending", () => {
    const a = make(100, [
      { outcome: "BUSY", count: 40 },
      { outcome: "RESOLVED", count: 60 },
    ]);
    const m = mergeOutcomeCounts([a]);
    expect(m.results.map((r) => r.outcome)).toEqual(["RESOLVED", "BUSY"]);
  });
});

describe("mergeCallBased", () => {
  const bucket = (
    date: string,
    total: number,
    breakdown: Record<string, number>
  ) => ({
    total_calls: total,
    completed_calls: total,
    failed_calls: 0,
    success_rate: 100,
    average_duration: 90,
    outcome_breakdown: breakdown,
    date,
  });

  const wrap = (results: ReturnType<typeof bucket>[]): CallBasedData => ({
    type: "call-based",
    time_granularity: "day",
    results,
  });

  it("merges buckets by date across parts", () => {
    const a = wrap([
      bucket("2026-06-01", 10, { RESOLVED: 6, BUSY: 4 }),
      bucket("2026-06-02", 20, { RESOLVED: 12 }),
    ]);
    const b = wrap([
      bucket("2026-06-01", 5, { RESOLVED: 2, TRANSFERRED: 3 }),
      bucket("2026-06-03", 8, { RESOLVED: 4 }),
    ]);
    const m = mergeCallBased([a, b]);
    expect(m.results).toHaveLength(3);
    const by = Object.fromEntries(m.results.map((r) => [r.date as string, r]));
    expect(by["2026-06-01"].total_calls).toBe(15);
    expect(by["2026-06-01"].outcome_breakdown.RESOLVED).toBe(8);
    expect(by["2026-06-01"].outcome_breakdown.TRANSFERRED).toBe(3);
    expect(by["2026-06-02"].total_calls).toBe(20);
    expect(by["2026-06-03"].total_calls).toBe(8);
  });

  it("returns results sorted by date ascending", () => {
    const a = wrap([
      bucket("2026-06-03", 1, {}),
      bucket("2026-06-01", 1, {}),
    ]);
    const m = mergeCallBased([a]);
    expect(m.results.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-03"]);
  });
});
