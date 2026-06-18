import type {
  CallBasedBucket,
  CallBasedData,
  OutcomeCount,
  OutcomeCountsData,
  PerformanceData,
} from "./types";

const emptyPerformance: PerformanceData = {
  type: "performance",
  filters_applied: {},
  results: {
    total_calls: 0,
    success_rate: 0,
    answer_rate: 0,
    failure_rate: 0,
    average_duration: 0,
    total_cost: null,
    cost_per_success: null,
    call_breakdown: { picked: 0, no_answer: 0, busy: 0, failed: 0 },
    outcome_distribution: {},
  },
};

function weightedAvg(
  parts: Array<{ value: number; weight: number }>
): number {
  const totalW = parts.reduce((acc, p) => acc + p.weight, 0);
  if (totalW <= 0) return 0;
  return parts.reduce((acc, p) => acc + p.value * p.weight, 0) / totalW;
}

export function mergePerformance(parts: PerformanceData[]): PerformanceData {
  if (parts.length === 0) return emptyPerformance;
  if (parts.length === 1) return parts[0];

  const totalCalls = parts.reduce((acc, p) => acc + p.results.total_calls, 0);
  const counts: Record<string, number> = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p.results.outcome_distribution)) {
      counts[k] = (counts[k] ?? 0) + v.count;
    }
  }
  const dist: Record<string, { count: number; percentage: number }> = {};
  for (const [k, c] of Object.entries(counts)) {
    dist[k] = {
      count: c,
      percentage: totalCalls > 0 ? (c / totalCalls) * 100 : 0,
    };
  }

  const breakdown = parts.reduce(
    (acc, p) => ({
      picked: acc.picked + p.results.call_breakdown.picked,
      no_answer: acc.no_answer + p.results.call_breakdown.no_answer,
      busy: acc.busy + p.results.call_breakdown.busy,
      failed: acc.failed + p.results.call_breakdown.failed,
    }),
    { picked: 0, no_answer: 0, busy: 0, failed: 0 }
  );

  const weighted = parts.map((p) => ({
    s: p.results.success_rate,
    a: p.results.answer_rate,
    f: p.results.failure_rate,
    d: p.results.average_duration,
    w: p.results.total_calls,
  }));

  return {
    type: "performance",
    filters_applied: parts[0].filters_applied,
    results: {
      total_calls: totalCalls,
      success_rate: weightedAvg(
        weighted.map(({ s, w }) => ({ value: s, weight: w }))
      ),
      answer_rate: weightedAvg(
        weighted.map(({ a, w }) => ({ value: a, weight: w }))
      ),
      failure_rate: weightedAvg(
        weighted.map(({ f, w }) => ({ value: f, weight: w }))
      ),
      average_duration: weightedAvg(
        weighted.map(({ d, w }) => ({ value: d, weight: w }))
      ),
      total_cost: null,
      cost_per_success: null,
      call_breakdown: breakdown,
      outcome_distribution: dist,
    },
  };
}

export function mergeOutcomeCounts(
  parts: OutcomeCountsData[]
): OutcomeCountsData {
  if (parts.length === 1) {
    return {
      ...parts[0],
      results: [...parts[0].results].sort((a, b) => b.count - a.count),
    };
  }

  const totalCalls = parts.reduce((acc, p) => acc + p.page_total_calls, 0);
  const counts = new Map<string, number>();
  for (const p of parts) {
    for (const r of p.results) {
      counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + r.count);
    }
  }
  const results: OutcomeCount[] = [...counts.entries()]
    .map(([outcome, count]) => ({
      outcome,
      count,
      percentage: totalCalls > 0 ? (count / totalCalls) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    type: "outcome-counts",
    filters_applied: parts[0]?.filters_applied ?? {},
    pagination: {
      page: 1,
      limit: results.length,
      total: results.length,
      total_pages: 1,
    },
    results,
    page_total_calls: totalCalls,
  };
}

export function mergeCallBased(parts: CallBasedData[]): CallBasedData {
  if (parts.length === 1) {
    return {
      ...parts[0],
      results: [...parts[0].results].sort((a, b) =>
        String(a.date ?? "").localeCompare(String(b.date ?? ""))
      ),
    };
  }

  const byDate = new Map<string, CallBasedBucket>();
  for (const p of parts) {
    for (const b of p.results) {
      const k = b.date ?? "__nodate";
      const cur = byDate.get(k);
      if (!cur) {
        byDate.set(k, {
          ...b,
          outcome_breakdown: { ...(b.outcome_breakdown ?? {}) },
        });
      } else {
        const mergedBreakdown = { ...(cur.outcome_breakdown ?? {}) };
        for (const [n, v] of Object.entries(b.outcome_breakdown ?? {})) {
          mergedBreakdown[n] = (mergedBreakdown[n] ?? 0) + v;
        }
        const total = cur.total_calls + b.total_calls;
        cur.total_calls = total;
        cur.completed_calls = cur.completed_calls + b.completed_calls;
        cur.failed_calls = cur.failed_calls + b.failed_calls;
        cur.success_rate = weightedAvg([
          { value: cur.success_rate, weight: cur.total_calls - b.total_calls },
          { value: b.success_rate, weight: b.total_calls },
        ]);
        cur.average_duration = weightedAvg([
          {
            value: cur.average_duration,
            weight: cur.total_calls - b.total_calls,
          },
          { value: b.average_duration, weight: b.total_calls },
        ]);
        cur.outcome_breakdown = mergedBreakdown;
      }
    }
  }

  const results = [...byDate.values()].sort((a, b) =>
    String(a.date ?? "").localeCompare(String(b.date ?? ""))
  );

  return {
    type: "call-based",
    time_granularity: parts[0].time_granularity,
    results,
  };
}
