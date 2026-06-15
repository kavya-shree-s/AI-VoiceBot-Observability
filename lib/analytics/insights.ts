import type { OutcomeStat, PerformanceData } from "./types";

export type InsightKind =
  | "resolutionDelta"
  | "transferDelta"
  | "testRideDelta"
  | "topOutcome"
  | "significantShift"
  | "summary";

export type InsightDirection = "up" | "down" | "neutral";

export type Insight = {
  id: string;
  kind: InsightKind;
  direction: InsightDirection;
  headline: string;
  detail?: string;
};

type Dist = Record<string, OutcomeStat>;

const NEUTRAL_PP = 1; // ignore deltas under 1 percentage point
const SHIFT_PP = 5; // call out outcome shifts above 5 percentage points

function stat(dist: Dist, key: string): OutcomeStat {
  return dist[key] ?? { count: 0, percentage: 0 };
}

function dirOf(delta: number): InsightDirection {
  if (delta >= NEUTRAL_PP) return "up";
  if (delta <= -NEUTRAL_PP) return "down";
  return "neutral";
}

function fmtPp(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${Math.abs(delta).toFixed(1)}pp`;
}

function topOutcome(dist: Dist): { name: string; stat: OutcomeStat } | null {
  let best: { name: string; stat: OutcomeStat } | null = null;
  for (const [name, s] of Object.entries(dist)) {
    if (!best || s.count > best.stat.count) best = { name, stat: s };
  }
  return best;
}

function testRideRate(dist: Dist): number {
  const req = stat(dist, "TEST_RIDE_REQUESTED").count;
  const ok = stat(dist, "TEST_RIDE_SUCCESS").count;
  return req > 0 ? (ok / req) * 100 : 0;
}

export function generateInsights(
  current: PerformanceData["results"],
  prior?: PerformanceData["results"]
): Insight[] {
  const out: Insight[] = [];
  const dist = current.outcome_distribution ?? {};
  const priorDist = prior?.outcome_distribution ?? {};

  // Top outcome (always emitted if we have data)
  const top = topOutcome(dist);
  if (top) {
    out.push({
      id: "top",
      kind: "topOutcome",
      direction: "neutral",
      headline: `${top.name} is the top outcome (${top.stat.percentage.toFixed(1)}%)`,
      detail: `${top.stat.count.toLocaleString()} of ${current.total_calls.toLocaleString()} calls.`,
    });
  }

  if (prior) {
    const resDelta = stat(dist, "RESOLVED").percentage - stat(priorDist, "RESOLVED").percentage;
    if (Math.abs(resDelta) >= NEUTRAL_PP) {
      const d = dirOf(resDelta);
      out.push({
        id: "res",
        kind: "resolutionDelta",
        direction: d,
        headline: `Resolution rate ${d === "up" ? "up" : "down"} ${fmtPp(resDelta)} vs prior period`,
      });
    }

    const trDelta = stat(dist, "TRANSFERRED").percentage - stat(priorDist, "TRANSFERRED").percentage;
    if (Math.abs(trDelta) >= NEUTRAL_PP) {
      const d = dirOf(trDelta);
      out.push({
        id: "tr",
        kind: "transferDelta",
        // Higher transfer rate is generally worse for an AI agent — invert.
        direction: d === "up" ? "down" : d === "down" ? "up" : "neutral",
        headline: `Transfer rate ${d === "up" ? "up" : "down"} ${fmtPp(trDelta)} vs prior period`,
      });
    }

    const rideNow = testRideRate(dist);
    const ridePrior = testRideRate(priorDist);
    const rideDelta = rideNow - ridePrior;
    if (Math.abs(rideDelta) >= NEUTRAL_PP) {
      const d = dirOf(rideDelta);
      out.push({
        id: "ride",
        kind: "testRideDelta",
        direction: d,
        headline: `Test-ride success ${d === "up" ? "up" : "down"} ${fmtPp(rideDelta)} vs prior period`,
      });
    }

    // Significant outcome shifts (>5pp) for the union of keys
    const keys = new Set([...Object.keys(dist), ...Object.keys(priorDist)]);
    let shiftId = 0;
    for (const k of keys) {
      if (k === "RESOLVED" || k === "TRANSFERRED") continue;
      const delta = stat(dist, k).percentage - stat(priorDist, k).percentage;
      if (Math.abs(delta) >= SHIFT_PP) {
        const d = dirOf(delta);
        out.push({
          id: `shift-${shiftId++}`,
          kind: "significantShift",
          direction: "neutral",
          headline: `${k} ${d === "up" ? "rose" : "fell"} ${fmtPp(delta)} vs prior period`,
        });
      }
    }
  }

  if (out.length === 0) {
    out.push({
      id: "summary",
      kind: "summary",
      direction: "neutral",
      headline: `${current.total_calls.toLocaleString()} total calls in range`,
    });
  }

  return out.slice(0, 6);
}
