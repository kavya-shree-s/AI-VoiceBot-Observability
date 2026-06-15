"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCallBasedTrend } from "../hooks";
import { Loading, ErrorBox, EmptyBox } from "../States";
import { ChartShell } from "./ChartShell";
import { colorFor, OTHER_COLOR } from "./colors";

const TOP_N = 6;

export function OutcomeStackedArea() {
  const { data, isLoading, error } = useCallBasedTrend("day");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

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
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { points: p, keys: k };
  }, [data]);

  const toggle = (k: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return (
    <ChartShell
      title="Outcome trend"
      subtitle="Daily composition (click legend to filter)"
    >
      {isLoading && <Loading label="Loading…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && points.length === 0 && (
        <EmptyBox label="No trend data for this range." />
      )}
      {!isLoading && !error && points.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={points}
              margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              {keys.map((k, i) => {
                const color = k === "Other" ? OTHER_COLOR : colorFor(i);
                return (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stackId="1"
                    stroke={color}
                    fill={color}
                    fillOpacity={hidden.has(k) ? 0 : 0.65}
                    strokeWidth={hidden.has(k) ? 0 : 1.5}
                    animationDuration={400}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-1.5 px-2 pb-1">
            {keys.map((k, i) => {
              const active = !hidden.has(k);
              const color = k === "Other" ? "var(--muted-2)" : colorFor(i);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition ${
                    active
                      ? "border-[var(--border-strong)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-2)] line-through"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-mono">{k}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </ChartShell>
  );
}
