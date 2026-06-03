"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useCallBasedTrend } from "../hooks";
import { Loading, ErrorBox, EmptyBox } from "../States";
import { colorFor } from "./colors";

const TOP_N = 6;

export function OutcomeStackedArea() {
  const { data, isLoading, error } = useCallBasedTrend("day");

  const { points, keys } = useMemo(() => {
    if (!data) return { points: [], keys: [] as string[] };
    const buckets = data.results.filter((b) => b.date);
    const totals = new Map<string, number>();
    for (const b of buckets) {
      for (const [name, n] of Object.entries(b.outcome_breakdown ?? {})) {
        totals.set(name, (totals.get(name) ?? 0) + n);
      }
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, TOP_N).map(([n]) => n);
    const hasOther = ranked.length > TOP_N;
    const k = hasOther ? [...top, "Other"] : top;
    const p = buckets
      .map((b) => {
        const row: Record<string, string | number> = { date: b.date as string };
        let other = 0;
        for (const [name, n] of Object.entries(b.outcome_breakdown ?? {})) {
          if (top.includes(name)) row[name] = n;
          else other += n;
        }
        for (const t of top) if (!(t in row)) row[t] = 0;
        if (hasOther) row.Other = other;
        return row;
      })
      .sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
      );
    return { points: p, keys: k };
  }, [data]);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Outcome Trend (stacked)</h3>
      {isLoading && <Loading label="Loading trend…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && points.length === 0 && (
        <EmptyBox label="No trend data for this range." />
      )}
      {!isLoading && !error && points.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={points}
            margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stackId="1"
                stroke={colorFor(i)}
                fill={colorFor(i)}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
