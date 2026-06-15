import type { CallRef } from "./types";

/**
 * Deterministically picks up to `n` calls spread across strata, so a sample
 * over many calls stays representative of each outcome/template rather than
 * over-weighting the largest group. Round-robins groups in first-seen order.
 */
export function stratifiedSample(
  calls: CallRef[],
  n: number,
  stratifyBy: "outcome" | "template"
): CallRef[] {
  if (n <= 0 || calls.length === 0) return [];
  if (calls.length <= n) return [...calls];

  const groups = new Map<string, CallRef[]>();
  for (const c of calls) {
    const key = c[stratifyBy] || "(none)";
    const g = groups.get(key) ?? [];
    g.push(c);
    groups.set(key, g);
  }

  const groupList = [...groups.values()];
  const cursors = new Array(groupList.length).fill(0);
  const result: CallRef[] = [];
  let i = 0;
  const safety = calls.length * 2;
  while (result.length < n && i < safety) {
    const idx = i % groupList.length;
    const g = groupList[idx];
    if (cursors[idx] < g.length) {
      result.push(g[cursors[idx]]);
      cursors[idx] += 1;
    }
    i += 1;
  }
  return result.slice(0, n);
}
