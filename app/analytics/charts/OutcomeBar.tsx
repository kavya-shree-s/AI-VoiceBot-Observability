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
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Outcome Counts</h3>
      {isLoading && <Loading label="Loading chart…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyBox label="No outcomes in this range." />
      )}
      {!isLoading && !error && rows.length > 0 && (
        <ResponsiveContainer
          width="100%"
          height={Math.max(260, rows.length * 28)}
        >
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={170}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <Tooltip cursor={{ fill: "var(--accent-soft)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {rows.map((r, i) => (
                <Cell key={r.name} fill={colorFor(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
