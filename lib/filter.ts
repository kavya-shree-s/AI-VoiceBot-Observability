import type { CsvRow } from "./types";

export type FilterOptions = {
  outcomes?: string[];
  startDate?: string;
  endDate?: string;
};

function parseRowTime(value: string): number | null {
  if (!value) return null;
  const isoish = value.includes("T") ? value : value.replace(" ", "T");
  const ms = Date.parse(isoish);
  return Number.isNaN(ms) ? null : ms;
}

export function filterRows(rows: CsvRow[], opts: FilterOptions): CsvRow[] {
  const outcomeSet =
    opts.outcomes && opts.outcomes.length > 0
      ? new Set(opts.outcomes)
      : null;
  const start = opts.startDate ? Date.parse(`${opts.startDate}T00:00:00`) : null;
  const end = opts.endDate ? Date.parse(`${opts.endDate}T23:59:59.999`) : null;

  return rows.filter((row) => {
    if (!row.callId) return false;
    if (outcomeSet && !outcomeSet.has(row.outcome)) return false;
    if (start !== null || end !== null) {
      const t = parseRowTime(row.startTime);
      if (t === null) return false;
      if (start !== null && t < start) return false;
      if (end !== null && t > end) return false;
    }
    return true;
  });
}

export function uniqueOutcomes(rows: CsvRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.outcome) set.add(r.outcome);
  return [...set].sort();
}
