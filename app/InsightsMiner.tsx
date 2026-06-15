"use client";

import { useState } from "react";
import { Sparkles, Download } from "lucide-react";
import type { CsvRow } from "@/lib/types";

type BreakdownRow = { category: string; detail: string; calls: number; pct: number };
type Summary = {
  reportDate: string;
  template: string;
  totalCalls: number;
  biggestCategory: { category: string; calls: number; pct: number };
  explicitHuman: number;
  unclassified: number;
};

function toCalls(rows: CsvRow[]) {
  return rows.map((r) => ({
    leadId: r.leadId || r.callId,
    callId: r.callId,
    phone: r.mobile,
    name: r.name,
    outcome: r.outcome,
    template: r.template,
    startTime: r.startTime,
  }));
}

export function InsightsMiner({ rows, token }: { rows: CsvRow[]; token: string }) {
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, calls: toCalls(rows) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBreakdown(data.breakdown ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function download() {
    setError(null);
    try {
      const res = await fetch("/api/insights?format=xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, calls: toCalls(rows) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call_analysis_${summary?.reportDate ?? "export"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section
      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-4"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <h3 className="text-h2">Transfer-reason analysis</h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
          {rows.length} calls in scope
        </span>
      </header>

      <div className="flex gap-2">
        <button
          onClick={analyze}
          disabled={running || rows.length === 0}
          className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-[13px] font-medium transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          {running ? `Classifying ${rows.length} calls…` : "Analyze transfer reasons"}
        </button>
        {breakdown.length > 0 && (
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-[13px] font-medium transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <Download className="h-3.5 w-3.5" />
            Download workbook (.xlsx)
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-[13px] text-[var(--danger)]">{error}</p>}

      {summary && (
        <p className="mt-3 text-caption text-[var(--muted)]">
          {summary.totalCalls} calls · biggest: {summary.biggestCategory.category} (
          {summary.biggestCategory.calls}, {summary.biggestCategory.pct}%) · explicit human:{" "}
          {summary.explicitHuman} · unclassified: {summary.unclassified}
        </p>
      )}

      {breakdown.length > 0 && (
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
              <th className="py-1 pr-2">Category</th>
              <th className="py-1 pr-2">Reason</th>
              <th className="py-1 pr-2 text-right">Calls</th>
              <th className="py-1 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((r, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="py-1.5 pr-2 font-mono text-[11px]">{r.category}</td>
                <td className="py-1.5 pr-2">{r.detail}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.calls}</td>
                <td className="py-1.5 text-right tabular-nums">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
