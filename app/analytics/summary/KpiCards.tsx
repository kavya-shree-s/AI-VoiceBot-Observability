"use client";

import { useMemo } from "react";
import {
  Phone,
  CheckCircle2,
  ArrowRightLeft,
  Percent,
  Sparkles,
  Clock,
} from "lucide-react";
import { deriveKpis } from "@/lib/analytics/derive";
import { usePerformance } from "../hooks";
import { Loading, ErrorBox } from "../States";

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function num(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

export function KpiCards() {
  const { data, isLoading, error } = usePerformance();
  const kpis = useMemo(() => (data ? deriveKpis(data.results) : null), [data]);

  if (isLoading) return <Loading label="Loading KPIs…" />;
  if (error) return <ErrorBox message={(error as Error).message} />;
  if (!kpis) return null;

  const cards: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }> = [
    { icon: Phone, label: "Total Calls", value: num(kpis.totalCalls) },
    { icon: CheckCircle2, label: "Resolved Calls", value: num(kpis.resolvedCalls) },
    { icon: Percent, label: "Resolution Rate", value: pct(kpis.resolutionRate) },
    { icon: ArrowRightLeft, label: "Transferred Calls", value: num(kpis.transferredCalls) },
    { icon: Percent, label: "Transfer Rate", value: pct(kpis.transferRate) },
    { icon: Sparkles, label: "Test Ride Success Rate", value: pct(kpis.testRideSuccessRate) },
    { icon: Phone, label: "Answer Rate", value: pct(kpis.answerRate) },
    { icon: Clock, label: "Avg Duration", value: `${kpis.averageDuration.toFixed(1)}s` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
        >
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
