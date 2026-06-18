import { describe, it, expect } from "vitest";
import {
  outcomeDailyPercentages,
  combinedOutcomeDailyPercentages,
} from "./trend";
import type { CallBasedData } from "./types";

const wrap = (
  results: Array<{
    date: string;
    total_calls: number;
    outcome_breakdown: Record<string, number>;
  }>
): CallBasedData => ({
  type: "call-based",
  time_granularity: "day",
  results: results.map((r) => ({
    ...r,
    completed_calls: r.total_calls,
    failed_calls: 0,
    success_rate: 100,
    average_duration: 0,
  })),
});

describe("outcomeDailyPercentages", () => {
  it("returns one row per date with each outcome's daily percentage", () => {
    const data = wrap([
      {
        date: "2026-06-01",
        total_calls: 100,
        outcome_breakdown: { RESOLVED: 50, TRANSFERRED: 30 },
      },
      {
        date: "2026-06-02",
        total_calls: 200,
        outcome_breakdown: { RESOLVED: 120, TRANSFERRED: 40 },
      },
    ]);
    const rows = outcomeDailyPercentages(data, ["RESOLVED", "TRANSFERRED"]);
    expect(rows).toEqual([
      {
        date: "2026-06-01",
        total_calls: 100,
        RESOLVED: 50,
        TRANSFERRED: 30,
      },
      {
        date: "2026-06-02",
        total_calls: 200,
        RESOLVED: 60,
        TRANSFERRED: 20,
      },
    ]);
  });

  it("returns 0 for missing outcomes on a given day", () => {
    const data = wrap([
      {
        date: "2026-06-01",
        total_calls: 50,
        outcome_breakdown: { TRANSFERRED: 50 },
      },
    ]);
    const rows = outcomeDailyPercentages(data, ["RESOLVED"]);
    expect(rows[0].RESOLVED).toBe(0);
  });

  it("returns 0 (not NaN) when a day has 0 total_calls", () => {
    const data = wrap([
      { date: "2026-06-01", total_calls: 0, outcome_breakdown: {} },
    ]);
    const rows = outcomeDailyPercentages(data, ["RESOLVED"]);
    expect(rows[0].RESOLVED).toBe(0);
  });

  it("returns an empty list when called with no outcomes", () => {
    const data = wrap([
      { date: "2026-06-01", total_calls: 100, outcome_breakdown: { RESOLVED: 50 } },
    ]);
    expect(outcomeDailyPercentages(data, [])).toEqual([
      { date: "2026-06-01", total_calls: 100 },
    ]);
  });

  it("sorts rows by date ascending and skips buckets without a date", () => {
    const data = wrap([
      { date: "2026-06-03", total_calls: 10, outcome_breakdown: { RESOLVED: 5 } },
      { date: "2026-06-01", total_calls: 10, outcome_breakdown: { RESOLVED: 1 } },
    ]);
    data.results.push({
      total_calls: 5,
      completed_calls: 5,
      failed_calls: 0,
      success_rate: 100,
      average_duration: 0,
      outcome_breakdown: { RESOLVED: 5 },
    });
    const rows = outcomeDailyPercentages(data, ["RESOLVED"]);
    expect(rows.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-03"]);
  });
});

describe("combinedOutcomeDailyPercentages", () => {
  it("sums the selected outcomes per day and returns one combined % series", () => {
    const data = wrap([
      {
        date: "2026-06-01",
        total_calls: 100,
        outcome_breakdown: {
          RESOLVED: 30,
          RESOLVED_NO_TEST_RIDE: 10,
          TEST_RIDE_SUCCESS: 5,
          BUSY: 20,
        },
      },
      {
        date: "2026-06-02",
        total_calls: 200,
        outcome_breakdown: {
          RESOLVED: 80,
          RESOLVED_NO_TEST_RIDE: 20,
          TEST_RIDE_SUCCESS: 0,
        },
      },
    ]);
    const rows = combinedOutcomeDailyPercentages(data, [
      "RESOLVED",
      "RESOLVED_NO_TEST_RIDE",
      "TEST_RIDE_SUCCESS",
    ]);
    expect(rows).toEqual([
      { date: "2026-06-01", total_calls: 100, combined_count: 45, combined: 45 },
      { date: "2026-06-02", total_calls: 200, combined_count: 100, combined: 50 },
    ]);
  });

  it("returns an empty list when no outcomes are selected", () => {
    const data = wrap([
      { date: "2026-06-01", total_calls: 100, outcome_breakdown: { RESOLVED: 50 } },
    ]);
    expect(combinedOutcomeDailyPercentages(data, [])).toEqual([]);
  });

  it("treats missing outcomes and zero total_calls as 0", () => {
    const data = wrap([
      { date: "2026-06-01", total_calls: 0, outcome_breakdown: {} },
      { date: "2026-06-02", total_calls: 50, outcome_breakdown: { TRANSFERRED: 50 } },
    ]);
    const rows = combinedOutcomeDailyPercentages(data, ["RESOLVED"]);
    expect(rows).toEqual([
      { date: "2026-06-01", total_calls: 0, combined_count: 0, combined: 0 },
      { date: "2026-06-02", total_calls: 50, combined_count: 0, combined: 0 },
    ]);
  });

  it("sorts rows by date ascending and skips buckets without a date", () => {
    const data = wrap([
      { date: "2026-06-03", total_calls: 10, outcome_breakdown: { RESOLVED: 5 } },
      { date: "2026-06-01", total_calls: 10, outcome_breakdown: { RESOLVED: 2 } },
    ]);
    const rows = combinedOutcomeDailyPercentages(data, ["RESOLVED"]);
    expect(rows.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-03"]);
  });
});
