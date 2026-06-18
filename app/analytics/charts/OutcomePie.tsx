"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePerformance } from "../hooks";
import { Loading, ErrorBox, EmptyBox } from "../States";
import { ChartShell } from "./ChartShell";
import { colorFor, OTHER_COLOR } from "./colors";

const TOP = 8;

export function OutcomePie() {
  const { data, isLoading, error } = usePerformance();

  const slices = useMemo(() => {
    if (!data) return [];
    const all = Object.entries(data.results.outcome_distribution)
      .map(([name, v]) => ({ name, value: v.count, percentage: v.percentage }))
      .sort((a, b) => b.value - a.value);
    if (all.length <= TOP) return all;
    const head = all.slice(0, TOP);
    const tail = all.slice(TOP);
    const other = tail.reduce(
      (acc, s) => ({
        name: "Other",
        value: acc.value + s.value,
        percentage: acc.percentage + s.percentage,
      }),
      { name: "Other", value: 0, percentage: 0 }
    );
    return [...head, other];
  }, [data]);

  const total = useMemo(
    () => slices.reduce((acc, s) => acc + s.value, 0),
    [slices]
  );

  return (
    <ChartShell
      title="Outcome distribution"
      subtitle={
        data ? `${data.results.total_calls.toLocaleString()} calls` : undefined
      }
    >
      {isLoading && <Loading label="Loading…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && slices.length === 0 && (
        <EmptyBox label="No outcomes in this range." />
      )}
      {!isLoading && !error && slices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 px-2 pb-2">
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  innerRadius={62}
                  paddingAngle={1.5}
                  strokeWidth={0}
                  animationDuration={400}
                >
                  {slices.map((s, i) => (
                    <Cell
                      key={s.name}
                      fill={s.name === "Other" ? OTHER_COLOR : colorFor(i)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const pct = (item?.payload as { percentage?: number } | undefined)?.percentage;
                    return `${value}${typeof pct === "number" ? ` (${pct.toFixed(1)}%)` : ""}`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centered total */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-caption text-[var(--muted)]">Total</div>
              <div className="text-display tabular-nums">
                {total.toLocaleString()}
              </div>
            </div>
          </div>
          <ul className="space-y-1.5 max-h-[260px] overflow-y-auto pr-2 text-[12px]">
            {slices.map((s, i) => (
              <li
                key={s.name}
                className="flex items-center gap-2 min-w-[180px]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{
                    backgroundColor:
                      s.name === "Other" ? "var(--muted-2)" : colorFor(i),
                  }}
                />
                <span className="font-mono text-[11px] truncate flex-1">
                  {s.name}
                </span>
                <span className="tabular-nums text-[var(--muted)]">
                  {s.percentage.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartShell>
  );
}
