"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { CsvRow } from "@/lib/types";

type MinedInsight = {
  tag: string;
  headline: string;
  frequency: number;
  example: string;
  suggestion: string;
};

/**
 * Drives the transcript insight-mining map-reduce over the currently-filtered
 * call set. Sends the call records (lead IDs + outcome/template) and the Breeze
 * token to /api/insights, which fetches transcripts live and asks Claude to
 * cluster recurring failure modes + template fixes.
 */
export function InsightsMiner({
  rows,
  token,
}: {
  rows: CsvRow[];
  token: string;
}) {
  const [mined, setMined] = useState<MinedInsight[]>([]);
  const [mining, setMining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  async function run() {
    setMining(true);
    setError(null);
    try {
      const calls = rows.map((r) => ({
        leadId: r.leadId || r.callId,
        callId: r.callId,
        outcome: r.outcome,
        template: r.template,
        startTime: r.startTime,
      }));
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, calls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMined(data.insights ?? []);
      setRan(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMining(false);
    }
  }

  return (
    <section
      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-4"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <h3 className="text-h2">Transcript insights</h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
          {rows.length} calls in scope
        </span>
      </header>

      <button
        onClick={run}
        disabled={mining || rows.length === 0}
        className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-[13px] font-medium transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
      >
        {mining ? "Mining transcripts…" : "Mine transcript insights"}
      </button>

      {error && (
        <p className="mt-2 text-[13px] text-[var(--danger)]">{error}</p>
      )}

      {ran && !mining && !error && mined.length === 0 && (
        <p className="mt-3 text-[13px] text-[var(--muted)]">
          No recurring patterns surfaced for this call set.
        </p>
      )}

      {mined.length > 0 && (
        <ul className="mt-3 space-y-2">
          {mined.map((m, i) => (
            <li
              key={i}
              className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium leading-snug">
                  {m.headline}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
                  {m.tag} · {m.frequency}×
                </span>
              </div>
              <p className="mt-1 text-caption text-[var(--muted)]">
                {m.suggestion}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
