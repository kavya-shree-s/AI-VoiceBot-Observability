"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { usePerformance } from "../hooks";
import { Loading, ErrorBox, EmptyBox } from "../States";
import { colorFor } from "./colors";

export function OutcomePie() {
  const { data, isLoading, error } = usePerformance();

  const slices = useMemo(() => {
    if (!data) return [];
    const all = Object.entries(data.results.outcome_distribution)
      .map(([name, v]) => ({ name, value: v.count, percentage: v.percentage }))
      .sort((a, b) => b.value - a.value);
    const TOP = 8;
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

  return (
    <ChartCard title="Outcome Distribution">
      {isLoading && <Loading label="Loading chart…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && slices.length === 0 && (
        <EmptyBox label="No outcomes in this range." />
      )}
      {!isLoading && !error && slices.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              outerRadius={110}
              innerRadius={50}
              paddingAngle={1}
            >
              {slices.map((s, i) => (
                <Cell key={s.name} fill={colorFor(i)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const pct = (item?.payload as { percentage?: number } | undefined)
                  ?.percentage;
                return `${value}${typeof pct === "number" ? ` (${pct.toFixed(2)}%)` : ""}`;
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}
