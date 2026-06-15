"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { usePerformance } from "../hooks";
import { Loading, ErrorBox, EmptyBox } from "../States";
import { ChartShell } from "./ChartShell";
import { colorFor } from "./colors";

export function OutcomeBar() {
  const { data, isLoading, error } = usePerformance();

  const rows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.results.outcome_distribution)
      .map(([name, v]) => ({ name, count: v.count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <ChartShell title="Outcome counts" subtitle="Sorted by volume">
      {isLoading && <Loading label="Loading…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyBox label="No outcomes in this range." />
      )}
      {!isLoading && !error && rows.length > 0 && (
        <ResponsiveContainer
          width="100%"
          height={Math.max(280, rows.length * 28)}
        >
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            barCategoryGap={6}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              interval={0}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: "var(--accent-soft)" }} />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              animationDuration={400}
            >
              {rows.map((r, i) => (
                <Cell key={r.name} fill={colorFor(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}
