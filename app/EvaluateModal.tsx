"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Sparkles,
} from "lucide-react";
import type { CsvRow } from "@/lib/types";
import {
  PARAMETERS,
  GROUP_LABELS,
  PARAM_BY_VALUE,
  selectionNeedsPrompt,
  selectionNeedsExtraction,
  type ParamGroup,
} from "@/lib/evaluation";
import { useAuth } from "./auth-context";

type Props = {
  row: CsvRow;
  onClose: () => void;
};

const GROUP_ORDER: ParamGroup[] = [
  "audio",
  "conversation",
  "extraction",
  "security",
];

export function EvaluateModal({ row, onClose }: Props) {
  const { token: authToken, signOut } = useAuth();
  const token = authToken ?? "";
  const [selected, setSelected] = useState<string[]>(["e2e_response_time"]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [extractionSchema, setExtractionSchema] = useState(
    '{\n  "customer_name": "string"\n}'
  );
  const [capturedVars, setCapturedVars] = useState(
    '{\n  "customer_name": ""\n}'
  );
  const [thresholdMs, setThresholdMs] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, running]);

  const needsPrompt = useMemo(() => selectionNeedsPrompt(selected), [selected]);
  const needsExtraction = useMemo(
    () => selectionNeedsExtraction(selected),
    [selected]
  );

  const toggle = (v: string) =>
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );

  const run = async () => {
    setError(null);
    if (selected.length === 0) {
      setError("Pick at least one parameter.");
      return;
    }
    if (needsPrompt && !inputPrompt.trim()) {
      setError("A bot prompt is required for the selected parameters.");
      return;
    }

    const body: Record<string, unknown> = {
      token,
      callId: row.callId,
      parameters: selected,
    };
    if (inputPrompt.trim()) body.input_prompt = inputPrompt.trim();
    if (thresholdMs.trim()) {
      const n = Number(thresholdMs);
      if (!Number.isNaN(n)) body.thresholds = { e2e_response_time_max_ms: n };
    }
    if (needsExtraction) {
      try {
        body.extraction_schema = JSON.parse(extractionSchema);
        body.bot_captured_variables = JSON.parse(capturedVars);
      } catch {
        setError("Extraction schema / captured variables must be valid JSON.");
        return;
      }
    }

    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        signOut({ expired: true });
        onClose();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult((data.result ?? {}) as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onClick={() => !running && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              Evaluate recording
            </h2>
            <p className="text-xs text-[var(--muted)] truncate">
              <span className="font-mono">{row.mobile || "—"}</span>
              {row.name && <span> · {row.name}</span>}
              <span className="text-[var(--muted-2)]"> · {row.callId}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            aria-label="Close"
            className="rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">
          {/* Parameters */}
          <div className="space-y-3">
            {GROUP_ORDER.map((group) => {
              const params = PARAMETERS.filter((p) => p.group === group);
              return (
                <div key={group}>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1.5">
                    {GROUP_LABELS[group]}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {params.map((p) => {
                      const active = selected.includes(p.value);
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => toggle(p.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                            active
                              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bot prompt */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
              Bot prompt (input_prompt)
              {needsPrompt && (
                <span className="text-[var(--danger)]"> · required</span>
              )}
            </label>
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              rows={3}
              placeholder="Paste the system prompt / bot instructions used during this call…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
            />
          </div>

          {/* Extraction inputs */}
          {needsExtraction && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  extraction_schema (JSON)
                </label>
                <textarea
                  value={extractionSchema}
                  onChange={(e) => setExtractionSchema(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  bot_captured_variables (JSON)
                </label>
                <textarea
                  value={capturedVars}
                  onChange={(e) => setCapturedVars(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
                />
              </div>
            </div>
          )}

          {/* Threshold */}
          {selected.includes("e2e_response_time") && (
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                e2e_response_time_max_ms (optional threshold)
              </label>
              <input
                type="number"
                value={thresholdMs}
                onChange={(e) => setThresholdMs(e.target.value)}
                placeholder="e.g. 800"
                className="w-40 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
              />
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-sm text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {result && <ResultView result={result} />}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <span className="text-xs text-[var(--muted)]">
            {selected.length} parameter{selected.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={run}
            disabled={running || selected.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-40 transition"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Evaluating…
              </>
            ) : (
              "Run evaluation"
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ResultView({ result }: { result: Record<string, unknown> }) {
  const entries = Object.entries(result);
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Evaluation returned no data.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        Results
      </p>
      {entries.map(([key, value]) => (
        <ResultCard key={key} name={key} value={value} />
      ))}
    </div>
  );
}

function ResultCard({ name, value }: { name: string; value: unknown }) {
  const label = PARAM_BY_VALUE[name]?.label ?? name;
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const passed = obj?.passed;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {passed !== undefined && <PassBadge passed={String(passed)} />}
      </div>
      {obj ? (
        <dl className="mt-1.5 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          {Object.entries(obj)
            .filter(([k]) => k !== "passed")
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--muted)]">{k}</dt>
                <dd className="font-mono break-words whitespace-pre-wrap">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
        </dl>
      ) : (
        <pre className="mt-1.5 text-xs font-mono whitespace-pre-wrap break-words">
          {typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value)}
        </pre>
      )}
    </div>
  );
}

function PassBadge({ passed }: { passed: string }) {
  const v = passed.toLowerCase();
  if (v === "true") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)]">
        <CheckCircle2 className="h-3.5 w-3.5" /> Passed
      </span>
    );
  }
  if (v === "false") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--danger)]">
        <XCircle className="h-3.5 w-3.5" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
      <MinusCircle className="h-3.5 w-3.5" /> N/A
    </span>
  );
}
