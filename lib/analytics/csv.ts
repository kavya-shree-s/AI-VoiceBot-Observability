import type { OutcomeCount } from "./types";

function esc(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function outcomesToCsv(rows: OutcomeCount[]): string {
  const header = "outcome,count,percentage";
  const body = rows.map(
    (r) => `${esc(r.outcome)},${r.count},${r.percentage}`
  );
  return [header, ...body].join("\n");
}
