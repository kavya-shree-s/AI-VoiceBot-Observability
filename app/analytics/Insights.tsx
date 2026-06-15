"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Sparkles, ArrowRight } from "lucide-react";
import { generateInsights, type Insight } from "@/lib/analytics/insights";
import { usePerformance, usePerformancePrev } from "./hooks";
import { Loading, ErrorBox } from "./States";

export function Insights() {
  const cur = usePerformance();
  const prev = usePerformancePrev();

  const insights = useMemo<Insight[]>(() => {
    if (!cur.data) return [];
    return generateInsights(cur.data.results, prev.data?.results);
  }, [cur.data, prev.data]);

  return (
    <section
      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-4"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <h3 className="text-h2">Insights</h3>
        {prev.isFetching && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
            vs prior period
          </span>
        )}
      </header>
      {cur.isLoading && <Loading label="Loading…" />}
      {cur.error && <ErrorBox message={(cur.error as Error).message} />}
      {!cur.isLoading && !cur.error && insights.length > 0 && (
        <ul className="space-y-2">
          {insights.map((i) => (
            <InsightRow key={i.id} insight={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const Icon =
    insight.direction === "up"
      ? TrendingUp
      : insight.direction === "down"
        ? TrendingDown
        : ArrowRight;
  const tone =
    insight.direction === "up"
      ? "text-[var(--success)] bg-[var(--success-soft)]"
      : insight.direction === "down"
        ? "text-[var(--danger)] bg-[var(--danger-soft)]"
        : "text-[var(--muted)] bg-[var(--surface-muted)]";
  return (
    <li className="flex items-start gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug">
          {insight.headline}
        </p>
        {insight.detail && (
          <p className="text-caption text-[var(--muted)]">{insight.detail}</p>
        )}
      </div>
    </li>
  );
}
