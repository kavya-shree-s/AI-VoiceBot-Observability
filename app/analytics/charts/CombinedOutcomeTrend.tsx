"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { combinedOutcomeDailyPercentages } from "@/lib/analytics/trend";
import { useCallBasedTrend } from "../hooks";
import { useAnalyticsStore } from "../store";
import { Loading, ErrorBox, EmptyBox } from "../States";
import { ChartShell } from "./ChartShell";

export function CombinedOutcomeTrend() {
  const { data, isLoading, error } = useCallBasedTrend("day");
  const appliedOutcomes = useAnalyticsStore((s) => s.applied.outcomes);

  const rows = useMemo(
    () =>
      data ? combinedOutcomeDailyPercentages(data, appliedOutcomes) : [],
    [data, appliedOutcomes]
  );

  const subtitle =
    appliedOutcomes.length > 0
      ? `Daily share where outcome was any of the ${appliedOutcomes.length} selected`
      : "Pick one or more outcomes in filters to see the combined trend";

  return (
    <ChartShell title="Combined outcome share" subtitle={subtitle}>
      {isLoading && <Loading label="Loading…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && appliedOutcomes.length === 0 && (
        <EmptyBox label="No outcomes selected." />
      )}
      {!isLoading && !error && appliedOutcomes.length > 0 && rows.length === 0 && (
        <EmptyBox label="No trend data for this range." />
      )}
      {!isLoading && !error && appliedOutcomes.length > 0 && rows.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={rows}
              margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id="combined-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
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
                formatter={(value, name, item) => {
                  if (name === "combined") {
                    const cnt = (item?.payload as { combined_count?: number; total_calls?: number } | undefined);
                    const c = cnt?.combined_count ?? 0;
                    const t = cnt?.total_calls ?? 0;
                    const v = typeof value === "number" ? value : Number(value);
                    return [`${v.toFixed(1)}%`, `${c} / ${t}`];
                  }
                  return [`${value}`, `${name}`];
                }}
              />
              <Area
                type="monotone"
                dataKey="combined"
                name="combined"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#combined-fill)"
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-1 px-2 pb-1">
            {appliedOutcomes.map((o) => (
              <span
                key={o}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-mono"
              >
                {o}
              </span>
            ))}
          </div>
        </>
      )}
    </ChartShell>
  );
}
