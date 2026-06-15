"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { outcomeDailyPercentages } from "@/lib/analytics/trend";
import { useCallBasedTrend } from "../hooks";
import { useAnalyticsStore } from "../store";
import { Loading, ErrorBox, EmptyBox } from "../States";
import { ChartShell } from "./ChartShell";
import { colorFor } from "./colors";

const FALLBACK_TOP_N = 3;

export function OutcomePercentageTrend() {
  const { data, isLoading, error } = useCallBasedTrend("day");
  const appliedOutcomes = useAnalyticsStore((s) => s.applied.outcomes);

  // Series to plot. If the user filtered to specific outcomes, plot those.
  // Otherwise default to the top-N outcomes across the range so the chart is
  // still informative.
  const series = useMemo(() => {
    if (appliedOutcomes.length > 0) return appliedOutcomes;
    if (!data) return [];
    const totals = new Map<string, number>();
    for (const b of data.results) {
      for (const [name, n] of Object.entries(b.outcome_breakdown ?? {})) {
        totals.set(name, (totals.get(name) ?? 0) + n);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, FALLBACK_TOP_N)
      .map(([n]) => n);
  }, [appliedOutcomes, data]);

  const rows = useMemo(
    () => (data ? outcomeDailyPercentages(data, series) : []),
    [data, series]
  );

  const subtitle =
    appliedOutcomes.length > 0
      ? `Daily % of total — ${appliedOutcomes.length} outcome${appliedOutcomes.length === 1 ? "" : "s"} selected`
      : `Daily % of total — top ${FALLBACK_TOP_N} outcomes (pick outcomes in filters to narrow)`;

  return (
    <ChartShell title="Outcome growth" subtitle={subtitle}>
      {isLoading && <Loading label="Loading…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyBox label="No trend data for this range." />
      )}
      {!isLoading && !error && rows.length > 0 && series.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={rows}
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
                unit="%"
                domain={[0, (max: number) => Math.min(100, Math.ceil(max + 5))]}
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? `${value.toFixed(1)}%` : `${value}`
                }
              />
              {series.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={colorFor(i)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                  animationDuration={400}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-1.5 px-2 pb-1">
            {series.map((name, i) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[11px]"
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: colorFor(i) }}
                />
                <span className="font-mono">{name}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </ChartShell>
  );
}
