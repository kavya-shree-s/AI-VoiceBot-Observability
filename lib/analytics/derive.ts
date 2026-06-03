import type { OutcomeStat, PerformanceData } from "./types";

export type Kpis = {
  totalCalls: number;
  resolvedCalls: number;
  resolutionRate: number;
  transferredCalls: number;
  transferRate: number;
  testRideSuccessRate: number;
  answerRate: number;
  averageDuration: number;
};

function statOf(
  dist: Record<string, OutcomeStat>,
  key: string
): OutcomeStat {
  return dist[key] ?? { count: 0, percentage: 0 };
}

export function deriveKpis(results: PerformanceData["results"]): Kpis {
  const dist = results.outcome_distribution ?? {};
  const resolved = statOf(dist, "RESOLVED");
  const transferred = statOf(dist, "TRANSFERRED");
  const requested = statOf(dist, "TEST_RIDE_REQUESTED").count;
  const success = statOf(dist, "TEST_RIDE_SUCCESS").count;
  return {
    totalCalls: results.total_calls,
    resolvedCalls: resolved.count,
    resolutionRate: resolved.percentage,
    transferredCalls: transferred.count,
    transferRate: transferred.percentage,
    testRideSuccessRate: requested > 0 ? (success / requested) * 100 : 0,
    answerRate: results.answer_rate,
    averageDuration: results.average_duration,
  };
}
