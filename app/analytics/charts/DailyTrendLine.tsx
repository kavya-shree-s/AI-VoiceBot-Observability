"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useCallBasedTrend } from "../hooks";
import { Loading, ErrorBox, EmptyBox } from "../States";

export function DailyTrendLine() {
  const { data, isLoading, error } = useCallBasedTrend("day");

  const series = useMemo(() => {
    if (!data) return [];
    return data.results
      .filter((b) => b.date)
      .map((b) => ({
        date: b.date as string,
        total: b.total_calls,
        resolved: b.outcome_breakdown?.RESOLVED ?? 0,
        transferred: b.outcome_breakdown?.TRANSFERRED ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Daily Trend</h3>
      {isLoading && <Loading label="Loading trend…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && series.length === 0 && (
        <EmptyBox label="No trend data for this range." />
      )}
      {!isLoading && !error && series.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={series}
            margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              name="Resolved"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="transferred"
              name="Transferred"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
