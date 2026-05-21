"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Loader2,
  AlertCircle,
  Download as DownloadIcon,
  Info,
} from "lucide-react";
import type { CsvRow } from "@/lib/types";

function parseMetadata(raw: string): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const obj = JSON.parse(raw) as unknown;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

type LoadState = "idle" | "loading" | "ready" | "error";

type RowState = {
  state: LoadState;
  blobUrl?: string;
  errorMessage?: string;
};

const PAGE_SIZE = 25;

export function PreviewPanel({
  rows,
  token,
}: {
  rows: CsvRow[];
  token: string;
}) {
  const [page, setPage] = useState(0);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [openInfoCallId, setOpenInfoCallId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const [lastRowsRef, setLastRowsRef] = useState<CsvRow[]>(rows);
  if (lastRowsRef !== rows) {
    setLastRowsRef(rows);
    setPage(0);
  }

  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
    };
  }, []);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [rows, page]
  );

  const current = currentCallId
    ? rows.find((r) => r.callId === currentCallId) ?? null
    : null;

  const updateRow = (callId: string, patch: Partial<RowState>) => {
    setRowStates((prev) => ({ ...prev, [callId]: { ...prev[callId], ...patch } }));
  };

  const loadRecording = async (callId: string): Promise<string | null> => {
    const cached = rowStates[callId]?.blobUrl;
    if (cached) return cached;
    updateRow(callId, { state: "loading", errorMessage: undefined });
    try {
      const res = await fetch("/api/recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, callId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.add(url);
      updateRow(callId, { state: "ready", blobUrl: url });
      return url;
    } catch (e) {
      updateRow(callId, {
        state: "error",
        errorMessage: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  };

  const play = async (callId: string) => {
    if (currentCallId === callId && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      return;
    }
    const url = await loadRecording(callId);
    if (!url) return;
    setCurrentCallId(callId);
    const audio = audioRef.current;
    if (audio) {
      audio.src = url;
      audio.currentTime = 0;
      await audio.play().catch(() => {});
    }
  };

  const downloadRow = async (callId: string, filename: string) => {
    const url = await loadRecording(callId);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      <header className="flex items-center gap-3 p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)]/95 backdrop-blur z-10">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-[var(--muted-2)]">
            Now playing
          </p>
          <p className="truncate text-sm font-medium">
            {current ? (
              <>
                <span className="font-mono">{current.mobile || "—"}</span>
                {current.name && (
                  <span className="text-[var(--muted)]"> · {current.name}</span>
                )}
              </>
            ) : (
              <span className="text-[var(--muted-2)]">Pick a recording below</span>
            )}
          </p>
        </div>
        <audio
          ref={audioRef}
          controls
          preload="none"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="h-9 min-w-[200px] sm:min-w-[320px]"
        />
      </header>

      <ul className="divide-y divide-[var(--border)] max-h-[480px] overflow-y-auto">
        {pageRows.map((r) => {
          const st = rowStates[r.callId];
          const isCurrent = currentCallId === r.callId;
          const playing = isCurrent && isPlaying;
          const loading = st?.state === "loading";
          const metadata = parseMetadata(r.metadata);
          const infoOpen = openInfoCallId === r.callId;
          const hasInfo =
            metadata !== null || (r.metadata && r.metadata.trim().length > 0);
          return (
            <li
              key={r.callId}
              className={`px-4 py-2.5 text-sm transition ${
                isCurrent
                  ? "bg-[var(--accent-soft)]"
                  : "hover:bg-[var(--surface-muted)]"
              }`}
            >
              <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => play(r.callId)}
                aria-label={playing ? "Pause" : "Play"}
                disabled={loading}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                  playing
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : playing ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 ml-0.5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-mono text-xs">
                    {r.mobile || "—"}
                  </span>
                  {r.name && (
                    <span className="text-[var(--muted)] truncate">
                      {r.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--muted)]">
                  {r.outcome && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-[var(--surface-muted)]">
                      {hasInfo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenInfoCallId((cur) =>
                              cur === r.callId ? null : r.callId
                            );
                          }}
                          aria-label={
                            infoOpen
                              ? "Hide outcome details"
                              : "Show outcome details"
                          }
                          aria-expanded={infoOpen}
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full transition ${
                            infoOpen
                              ? "text-[var(--accent)]"
                              : "text-[var(--muted)] hover:text-[var(--accent)]"
                          }`}
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      )}
                      {r.outcome}
                    </span>
                  )}
                  <span className="font-mono">{r.startTime}</span>
                  {r.duration && <span>{r.duration}s</span>}
                </div>
                {st?.state === "error" && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--danger)]">
                    <AlertCircle className="h-3 w-3" />
                    {st.errorMessage}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadRow(
                    r.callId,
                    `${r.mobile || "unknown"}_${r.name || "unknown"}_${r.callId}.mp3`
                  )
                }
                aria-label="Download this recording"
                className="shrink-0 rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
              </button>
              </div>
              {infoOpen && hasInfo && (
                <div className="mt-2 ml-11 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                  {metadata ? (
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
                      {Object.entries(metadata).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-[var(--muted)]">{formatKey(k)}</dt>
                          <dd className="font-mono text-[var(--foreground)] break-words">
                            {formatValue(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-mono text-[var(--foreground)]">
                      {r.metadata}
                    </pre>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pageCount > 1 && (
        <footer className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          <span>
            {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-40"
            >
              Prev
            </button>
            <span className="tabular-nums">
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
