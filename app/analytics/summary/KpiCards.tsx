"use client";

import { useMemo } from "react";
import {
  Phone,
  CheckCircle2,
  ArrowRightLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { deriveKpis } from "@/lib/analytics/derive";
import { usePerformance, usePerformancePrev } from "../hooks";
import { Loading, ErrorBox } from "../States";

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function num(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function deltaPp(now: number, prior: number | undefined): number | null {
  if (typeof prior !== "number" || !Number.isFinite(prior)) return null;
  return now - prior;
}

export function KpiCards() {
  const cur = usePerformance();
  const prev = usePerformancePrev();

  const kpis = useMemo(
    () => (cur.data ? deriveKpis(cur.data.results) : null),
    [cur.data]
  );
  const kpisPrev = useMemo(
    () => (prev.data ? deriveKpis(prev.data.results) : null),
    [prev.data]
  );

  if (cur.isLoading) return <Loading label="Loading KPIs…" />;
  if (cur.error) return <ErrorBox message={(cur.error as Error).message} />;
  if (!kpis) return null;

  const cards: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    delta: number | null;
    deltaSuffix: "pp" | "%" | "count";
    invertColor?: boolean;
  }> = [
    {
      icon: Phone,
      label: "Total calls",
      value: num(kpis.totalCalls),
      delta:
        kpisPrev && kpisPrev.totalCalls
          ? ((kpis.totalCalls - kpisPrev.totalCalls) / kpisPrev.totalCalls) * 100
          : null,
      deltaSuffix: "%",
    },
    {
      icon: CheckCircle2,
      label: "Resolved calls",
      value: num(kpis.resolvedCalls),
      delta:
        kpisPrev && kpisPrev.resolvedCalls
          ? ((kpis.resolvedCalls - kpisPrev.resolvedCalls) /
              kpisPrev.resolvedCalls) *
            100
          : null,
      deltaSuffix: "%",
    },
    {
      icon: Sparkles,
      label: "Resolution rate",
      value: pct(kpis.resolutionRate),
      delta: deltaPp(kpis.resolutionRate, kpisPrev?.resolutionRate),
      deltaSuffix: "pp",
    },
    {
      icon: ArrowRightLeft,
      label: "Transferred calls",
      value: num(kpis.transferredCalls),
      delta:
        kpisPrev && kpisPrev.transferredCalls
          ? ((kpis.transferredCalls - kpisPrev.transferredCalls) /
              kpisPrev.transferredCalls) *
            100
          : null,
      deltaSuffix: "%",
      invertColor: true,
    },
    {
      icon: ArrowRightLeft,
      label: "Transfer rate",
      value: pct(kpis.transferRate),
      delta: deltaPp(kpis.transferRate, kpisPrev?.transferRate),
      deltaSuffix: "pp",
      invertColor: true,
    },
    {
      icon: Sparkles,
      label: "Test-ride success",
      value: pct(kpis.testRideSuccessRate),
      delta: deltaPp(kpis.testRideSuccessRate, kpisPrev?.testRideSuccessRate),
      deltaSuffix: "pp",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {cards.map((c) => (
        <Card key={c.label} {...c} />
      ))}
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  delta,
  deltaSuffix,
  invertColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: number | null;
  deltaSuffix: "pp" | "%" | "count";
  invertColor?: boolean;
}) {
  const isFlat = delta === null || Math.abs(delta) < 0.5;
  const goodWhenUp = !invertColor;
  const tone =
    isFlat || delta === null
      ? "text-[var(--muted)] bg-[var(--surface-muted)]"
      : (delta > 0) === goodWhenUp
        ? "text-[var(--success)] bg-[var(--success-soft)]"
        : "text-[var(--danger)] bg-[var(--danger-soft)]";
  const TrendIcon =
    isFlat || delta === null
      ? Minus
      : delta > 0
        ? TrendingUp
        : TrendingDown;
  return (
    <div
      className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 shadow-[var(--shadow-sm)]"
      style={{ borderRadius: "var(--radius-md)" }}
    >
      <div className="flex items-center gap-1.5 text-caption text-[var(--muted)]">
        <Icon className="h-3 w-3" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-h1 tabular-nums leading-none">{value}</p>
        {delta !== null && (
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${tone}`}
          >
            <TrendIcon className="h-3 w-3" />
            {Math.abs(delta).toFixed(deltaSuffix === "pp" ? 1 : 1)}
            {deltaSuffix === "pp" ? "pp" : "%"}
          </span>
        )}
      </div>
    </div>
  );
}
