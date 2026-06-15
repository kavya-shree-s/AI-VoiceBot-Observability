import { formatDate } from "./presets";
import type { DateRange } from "./types";

function parseLocal(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * The window of equal length immediately preceding `current`.
 * Example: 7-day window 2026-05-28..2026-06-03 → 2026-05-21..2026-05-27.
 */
export function priorPeriod(current: DateRange): DateRange {
  const from = parseLocal(current.from);
  const to = parseLocal(current.to);
  const lengthDays = diffDays(from, to) + 1;
  const priorTo = new Date(from);
  priorTo.setDate(priorTo.getDate() - 1);
  const priorFrom = new Date(priorTo);
  priorFrom.setDate(priorFrom.getDate() - (lengthDays - 1));
  return { from: formatDate(priorFrom), to: formatDate(priorTo) };
}
