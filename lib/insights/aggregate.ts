import type { CallLabel } from "./types";

export type BreakdownRow = {
  category: string;
  detail: string;
  calls: number;
  pct: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function reasonBreakdown(labels: CallLabel[]): BreakdownRow[] {
  const total = labels.length || 1;
  const counts = new Map<string, BreakdownRow>();
  for (const l of labels) {
    const key = `${l.reasonCategory}||${l.reasonDetail}`;
    const row = counts.get(key) ?? {
      category: l.reasonCategory,
      detail: l.reasonDetail,
      calls: 0,
      pct: 0,
    };
    row.calls += 1;
    counts.set(key, row);
  }
  const rows = [...counts.values()];
  for (const r of rows) r.pct = round1((r.calls / total) * 100);
  rows.sort((a, b) => b.calls - a.calls || a.category.localeCompare(b.category));
  return rows;
}

export type Summary = {
  reportDate: string;
  template: string;
  totalCalls: number;
  biggestCategory: { category: string; calls: number; pct: number };
  explicitHuman: number;
  unclassified: number;
};

export function summary(
  labels: CallLabel[],
  opts: { reportDate: string; template: string }
): Summary {
  const total = labels.length;
  const byCat = new Map<string, number>();
  for (const l of labels) byCat.set(l.reasonCategory, (byCat.get(l.reasonCategory) ?? 0) + 1);
  let biggest = { category: "—", calls: 0, pct: 0 };
  for (const [category, calls] of byCat) {
    if (calls > biggest.calls) {
      biggest = { category, calls, pct: round1((calls / (total || 1)) * 100) };
    }
  }
  return {
    reportDate: opts.reportDate,
    template: opts.template,
    totalCalls: total,
    biggestCategory: biggest,
    explicitHuman: labels.filter((l) => l.explicitHuman).length,
    unclassified: labels.filter((l) => l.reasonCategory === "UNCLASSIFIED").length,
  };
}

export function qaSubset(
  labels: CallLabel[],
  predicate: (l: CallLabel) => boolean
): CallLabel[] {
  return labels.filter(predicate);
}
