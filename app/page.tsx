"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyRound,
  Upload,
  Filter,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  RotateCcw,
  Phone,
  Layers,
  Search,
  X,
} from "lucide-react";
import { parseCsv } from "@/lib/csv";
import { filterRows, uniqueOutcomes, uniqueTemplates } from "@/lib/filter";
import { buildAudioFilename } from "@/lib/sanitize";
import type { CsvRow } from "@/lib/types";

type Template = { id: string; name: string; is_active: boolean };

type Stage = "idle" | "submitting" | "running" | "done" | "error";

const TOKEN_KEY = "breeze-bearer-token";

export default function Page() {
  const [token, setToken] = useState("");
  const [rememberToken, setRememberToken] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [mobileQuery, setMobileQuery] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [remoteTemplates, setRemoteTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
  }>({ total: 0, completed: 0, failed: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (t) {
      setToken(t);
      setRememberToken(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (rememberToken && token) sessionStorage.setItem(TOKEN_KEY, token);
    if (!rememberToken) sessionStorage.removeItem(TOKEN_KEY);
  }, [rememberToken, token]);

  const outcomes = useMemo(() => uniqueOutcomes(rows), [rows]);
  const csvTemplates = useMemo(() => uniqueTemplates(rows), [rows]);
  const allTemplates = useMemo(() => {
    const map = new Map<string, Template>();
    for (const t of remoteTemplates) map.set(t.name, t);
    for (const name of csvTemplates) {
      if (!map.has(name)) map.set(name, { id: name, name, is_active: true });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [remoteTemplates, csvTemplates]);
  const visibleTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return allTemplates;
    return allTemplates.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTemplates, templateSearch]);

  const filtered = useMemo(
    () =>
      filterRows(rows, {
        outcomes: selectedOutcomes,
        templates: selectedTemplates,
        mobileSubstring: mobileQuery || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    [
      rows,
      selectedOutcomes,
      selectedTemplates,
      mobileQuery,
      startDate,
      endDate,
    ]
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const clean = token.trim();
    if (!clean) {
      setRemoteTemplates([]);
      setTemplatesError(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setRemoteTemplates((data.templates ?? []) as Template[]);
      } catch (e) {
        setTemplatesError(e instanceof Error ? e.message : String(e));
        setRemoteTemplates([]);
      } finally {
        setTemplatesLoading(false);
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [token]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onFile = async (file: File) => {
    setCsvName(file.name);
    const text = await file.text();
    const { rows: parsed, errors } = parseCsv(text);
    setRows(parsed);
    setCsvErrors(errors);
    setSelectedOutcomes([]);
    setSelectedTemplates([]);
    setMobileQuery("");
    setStartDate("");
    setEndDate("");
  };

  const toggleOutcome = (o: string) => {
    setSelectedOutcomes((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  };

  const toggleTemplate = (name: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const submit = async () => {
    if (!token) {
      setErrorMessage("Please paste your Bearer token first.");
      return;
    }
    if (filtered.length === 0) {
      setErrorMessage("No rows match your filters.");
      return;
    }
    setErrorMessage(null);
    setStage("submitting");
    setProgress({ total: filtered.length, completed: 0, failed: 0 });

    const items = filtered.map((r) => ({
      callId: r.callId,
      filename: buildAudioFilename({
        mobile: r.mobile,
        name: r.name,
        callId: r.callId,
      }),
    }));

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Job creation failed (${res.status})`);
      }
      const { id } = (await res.json()) as { id: string };
      pollJob(id);
      setStage("running");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const pollJob = (id: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) throw new Error(`Status check failed (${res.status})`);
        const data = (await res.json()) as {
          status: Stage;
          total: number;
          completed: number;
          failed: number;
          errorMessage?: string;
        };
        setProgress({
          total: data.total,
          completed: data.completed,
          failed: data.failed,
        });
        if (data.status === "done") {
          stopPolling();
          setStage("done");
          window.location.href = `/api/jobs/${id}/download`;
        } else if (data.status === "error") {
          stopPolling();
          setStage("error");
          setErrorMessage(data.errorMessage ?? "Extraction failed.");
        }
      } catch (e) {
        stopPolling();
        setStage("error");
        setErrorMessage(e instanceof Error ? e.message : String(e));
      }
    }, 800);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const reset = () => {
    stopPolling();
    setStage("idle");
    setProgress({ total: 0, completed: 0, failed: 0 });
    setErrorMessage(null);
  };

  const busy = stage === "submitting" || stage === "running";
  const pct =
    progress.total > 0
      ? Math.min(
          100,
          Math.round(
            ((progress.completed + progress.failed) / progress.total) * 100
          )
        )
      : 0;

  const stepDone = {
    1: token.length > 0,
    2: rows.length > 0,
    3: rows.length > 0,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16 space-y-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] shadow-sm">
          <Sparkles className="h-3 w-3 text-[var(--accent)]" />
          Breeze Buddy · Recording Extractor
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Bulk-download call recordings
        </h1>
        <p className="text-sm sm:text-base text-[var(--muted)] max-w-xl">
          Upload your daily CSV, filter the rows you care about, and grab every
          matching recording as a single ZIP — usually under a minute.
        </p>
      </header>

      <Card>
        <Step number={1} done={stepDone[1]} title="Bearer token" icon={KeyRound}>
          <input
            type="password"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm font-mono placeholder:font-sans placeholder:text-[var(--muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
            placeholder="Paste your Authorization Bearer token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={rememberToken}
              onChange={(e) => setRememberToken(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
            />
            Remember in this browser tab
          </label>
        </Step>
      </Card>

      <Card>
        <Step
          number={2}
          done={stepDone[2]}
          title="CSV file"
          icon={FileSpreadsheet}
        >
          <label className="group relative block w-full cursor-pointer rounded-lg border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-6 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="sr-only"
            />
            <Upload className="mx-auto h-5 w-5 text-[var(--muted)] group-hover:text-[var(--accent)] transition" />
            <p className="mt-2 text-sm font-medium">
              {csvName ? (
                <>
                  <span className="font-mono">{csvName}</span>
                </>
              ) : (
                "Click to upload, or drop a CSV here"
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {csvName
                ? `${rows.length} rows loaded · click to replace`
                : "Expected: call_details_YYYY-MM-DD.csv"}
            </p>
          </label>
          {csvErrors.length > 0 && (
            <details className="mt-3 text-xs text-[var(--warning)]">
              <summary className="cursor-pointer">
                {csvErrors.length} parsing warning(s)
              </summary>
              <ul className="list-disc ml-5 mt-1 space-y-0.5">
                {csvErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </Step>
      </Card>

      {rows.length > 0 && (
        <Card>
          <Step number={3} done={stepDone[3]} title="Filters" icon={Filter}>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-2">
                  <Layers className="inline h-3 w-3 mr-1 -mt-0.5" />
                  Template{" "}
                  <span className="text-[var(--muted-2)]">
                    (none = all)
                  </span>
                  {templatesLoading && (
                    <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-[var(--accent)]" />
                  )}
                </label>

                {selectedTemplates.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedTemplates.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[11px] font-medium"
                      >
                        <span className="font-mono">{name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${name}`}
                          onClick={() => toggleTemplate(name)}
                          className="rounded-full hover:bg-white/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTemplatesOpen((v) => !v)}
                    className="w-full inline-flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm hover:border-[var(--border-strong)] transition"
                  >
                    <span className="text-[var(--muted)]">
                      {selectedTemplates.length > 0
                        ? `${selectedTemplates.length} selected`
                        : allTemplates.length > 0
                          ? `Pick from ${allTemplates.length} templates`
                          : "No templates available yet"}
                    </span>
                    <Search className="h-3.5 w-3.5 text-[var(--muted-2)]" />
                  </button>

                  {templatesOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-[var(--border)]">
                        <input
                          type="text"
                          autoFocus
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                          placeholder="Search templates…"
                          className="w-full rounded-md bg-[var(--surface-muted)] border border-transparent focus:border-[var(--accent)] focus:outline-none px-2 py-1.5 text-sm"
                        />
                      </div>
                      <ul className="max-h-60 overflow-y-auto py-1 text-sm">
                        {visibleTemplates.length === 0 && (
                          <li className="px-3 py-2 text-xs text-[var(--muted-2)]">
                            No templates match.
                          </li>
                        )}
                        {visibleTemplates.map((t) => {
                          const active = selectedTemplates.includes(t.name);
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => toggleTemplate(t.name)}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--accent-soft)] transition ${
                                  active ? "text-[var(--accent)]" : ""
                                }`}
                              >
                                <span className="font-mono text-xs truncate">
                                  {t.name}
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  {!t.is_active && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--muted-2)]">
                                      inactive
                                    </span>
                                  )}
                                  {active && (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedTemplates([])}
                          disabled={selectedTemplates.length === 0}
                          className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
                        >
                          Clear all
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplatesOpen(false)}
                          className="font-medium text-[var(--accent)] hover:opacity-80"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {templatesError && (
                  <p className="mt-1 text-xs text-[var(--warning)]">
                    Couldn&apos;t load templates: {templatesError}. Falling back
                    to templates found in CSV.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-2">
                  <Phone className="inline h-3 w-3 mr-1 -mt-0.5" />
                  Mobile number{" "}
                  <span className="text-[var(--muted-2)]">
                    (partial match)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="tel"
                  value={mobileQuery}
                  onChange={(e) => setMobileQuery(e.target.value)}
                  placeholder="e.g. 9945 or +91 80889"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-mono placeholder:font-sans placeholder:text-[var(--muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-2">
                  Outcomes{" "}
                  <span className="text-[var(--muted-2)]">
                    (none = all)
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {outcomes.map((o) => {
                    const active = selectedOutcomes.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => toggleOutcome(o)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                          active
                            ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-2">
                    <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-2">
                    <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
                  />
                </div>
              </div>
            </div>
          </Step>
        </Card>
      )}

      <div className="sticky bottom-4 z-10">
        <Card>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">
                {filtered.length}
              </span>
              <span className="text-sm text-[var(--muted)]">
                of {rows.length} recordings ready
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(stage === "done" || stage === "error") && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:border-[var(--border-strong)] transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start over
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={busy || rows.length === 0 || filtered.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download ZIP
                  </>
                )}
              </button>
            </div>
          </div>

          {busy && (
            <div className="mt-4 space-y-2">
              <div className="h-1.5 w-full bg-[var(--surface-muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--muted)] tabular-nums">
                <span>
                  {progress.completed + progress.failed} / {progress.total} done
                </span>
                <div className="flex items-center gap-3">
                  {progress.completed > 0 && (
                    <span className="text-[var(--success)]">
                      ✓ {progress.completed}
                    </span>
                  )}
                  {progress.failed > 0 && (
                    <span className="text-[var(--warning)]">
                      ! {progress.failed}
                    </span>
                  )}
                  <span>{pct}%</span>
                </div>
              </div>
            </div>
          )}

          {stage === "done" && (
            <p className="mt-3 flex items-start gap-2 text-sm text-[var(--success)]">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                ZIP downloaded.{" "}
                {progress.failed > 0
                  ? `Includes _errors.csv with ${progress.failed} failure(s).`
                  : "All recordings included."}
              </span>
            </p>
          )}
          {errorMessage && (
            <p className="mt-3 flex items-start gap-2 text-sm text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}
        </Card>
      </div>

      <footer className="pt-2 text-xs text-[var(--muted)] flex flex-wrap gap-x-4 gap-y-1">
        <span>
          File naming:{" "}
          <code className="font-mono text-[var(--foreground)]/80">
            mobile_name_callId.mp3
          </code>
        </span>
        <span>
          Failures → <code className="font-mono">_errors.csv</code>
        </span>
        <span className="ml-auto opacity-60">
          Token never leaves this session.
        </span>
      </footer>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/80">
      {children}
    </section>
  );
}

function Step({
  number,
  done,
  title,
  icon: Icon,
  children,
}: {
  number: number;
  done: boolean;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
            done
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--surface-muted)] text-[var(--muted)] border border-[var(--border)]"
          }`}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : number}
        </div>
        <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--muted)]" />
          {title}
        </h2>
      </div>
      <div className="pl-10">{children}</div>
    </div>
  );
}
