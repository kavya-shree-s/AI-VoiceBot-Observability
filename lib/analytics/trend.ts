import type { CallBasedData } from "./types";

export type PercentageTrendRow = {
  date: string;
  total_calls: number;
  /** dynamic outcome → percentage entries */
  [outcome: string]: string | number;
};

/**
 * For each daily bucket that has a date, compute the percentage of each
 * requested outcome (count / total_calls * 100). Days with 0 total_calls
 * resolve to 0 rather than NaN so the chart line stays continuous.
 */
export function outcomeDailyPercentages(
  data: CallBasedData,
  outcomes: string[]
): PercentageTrendRow[] {
  return data.results
    .filter((b) => typeof b.date === "string" && b.date.length > 0)
    .map((b) => {
      const row: PercentageTrendRow = {
        date: b.date as string,
        total_calls: b.total_calls,
      };
      for (const name of outcomes) {
        const n = b.outcome_breakdown?.[name] ?? 0;
        row[name] = b.total_calls > 0 ? (n / b.total_calls) * 100 : 0;
      }
      return row;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type CombinedTrendRow = {
  date: string;
  total_calls: number;
  combined_count: number;
  combined: number; // percentage 0–100
};

/**
 * Per-day percentage that ANY of the selected outcomes was the outcome.
 * Useful when multiple selected outcomes are semantically equivalent (e.g.
 * RESOLVED, RESOLVED_NO_TEST_RIDE, TEST_RIDE_SUCCESS all read as "good").
 */
export function combinedOutcomeDailyPercentages(
  data: CallBasedData,
  outcomes: string[]
): CombinedTrendRow[] {
  if (outcomes.length === 0) return [];
  return data.results
    .filter((b) => typeof b.date === "string" && b.date.length > 0)
    .map((b) => {
      const combinedCount = outcomes.reduce(
        (acc, name) => acc + (b.outcome_breakdown?.[name] ?? 0),
        0
      );
      return {
        date: b.date as string,
        total_calls: b.total_calls,
        combined_count: combinedCount,
        combined: b.total_calls > 0 ? (combinedCount / b.total_calls) * 100 : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
