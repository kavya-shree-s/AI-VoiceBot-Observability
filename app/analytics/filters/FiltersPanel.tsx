"use client";

import { useMemo, useState } from "react";
import {
  RotateCcw,
  Check,
  X,
  Layers,
  Search,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { PRESET_LABELS } from "@/lib/analytics/presets";
import type { PresetKey } from "@/lib/analytics/types";
import { useAnalyticsStore, TEMPLATE_CAP } from "../store";
import { useTemplates } from "../hooks";
import { SavedViews } from "../SavedViews";

const PRESETS: PresetKey[] = [
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "thismonth",
  "previousmonth",
];

const KNOWN_OUTCOMES = [
  "RESOLVED",
  "TRANSFERRED",
  "NOT_BLOCKED",
  "TEST_RIDE_REQUESTED",
  "TEST_RIDE_SUCCESS",
  "RESOLVED_NO_TEST_RIDE",
  "DRIVER_FOUND",
  "DRIVER_NOT_FOUND",
  "DRIVER_WAITING",
  "BUSY",
  "NO_ANSWER",
  "BLOCKED_REDIRECT",
  "CANCELLED_EARLY",
  "RIDE_CONFIRMED",
  "NO_HELP_NEEDED",
  "CUSTOMER_COMING",
  "UNKNOWN",
];

export function FiltersPanel() {
  const draft = useAnalyticsStore((s) => s.draft);
  const setDraftFrom = useAnalyticsStore((s) => s.setDraftFrom);
  const setDraftTo = useAnalyticsStore((s) => s.setDraftTo);
  const toggleDraftOutcome = useAnalyticsStore((s) => s.toggleDraftOutcome);
  const clearDraftOutcomes = useAnalyticsStore((s) => s.clearDraftOutcomes);
  const toggleDraftTemplate = useAnalyticsStore((s) => s.toggleDraftTemplate);
  const clearDraftTemplates = useAnalyticsStore((s) => s.clearDraftTemplates);
  const applyPreset = useAnalyticsStore((s) => s.applyPreset);
  const apply = useAnalyticsStore((s) => s.apply);
  const reset = useAnalyticsStore((s) => s.reset);
  const [outcomesOpen, setOutcomesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const {
    data: templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useTemplates();
  const visibleTemplates = useMemo(() => {
    const list = templates ?? [];
    const q = templateSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, templateSearch]);

  return (
    <section
      className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] px-3 py-2.5"
      style={{ borderRadius: "var(--radius-md)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset chips */}
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] transition"
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        <Divider />

        {/* Date inputs */}
        <input
          type="date"
          value={draft.date_from}
          onChange={(e) => setDraftFrom(e.target.value)}
          aria-label="From date"
          className="rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition"
        />
        <span className="text-[var(--muted-2)] text-[11px]">→</span>
        <input
          type="date"
          value={draft.date_to}
          onChange={(e) => setDraftTo(e.target.value)}
          aria-label="To date"
          className="rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition"
        />

        <Divider />

        {/* Template multi-select */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTemplatesOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[12px] hover:border-[var(--border-strong)] transition"
          >
            <Layers className="h-3 w-3" />
            <span>Templates</span>
            {draft.templates.length > 0 && (
              <span className="rounded bg-[var(--accent)] px-1 py-0.5 text-[10px] font-medium text-[var(--accent-fg)] tabular-nums">
                {draft.templates.length}
              </span>
            )}
            {templatesLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {templatesOpen && (
            <div className="absolute left-0 mt-1 w-[440px] max-w-[90vw] rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] z-30 overflow-hidden">
              <div className="p-1.5 border-b border-[var(--border)]">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--muted-2)]" />
                  <input
                    autoFocus
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="w-full pl-6 pr-2 py-1 rounded-md bg-[var(--surface-muted)] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>
              <ul className="max-h-60 overflow-y-auto py-1 text-[12px]">
                {visibleTemplates.length === 0 && !templatesLoading && (
                  <li className="px-3 py-2 text-[11px] text-[var(--muted-2)]">
                    {templatesError
                      ? `Couldn't load: ${(templatesError as Error).message}`
                      : "No templates match."}
                  </li>
                )}
                {visibleTemplates.map((t) => {
                  const active = draft.templates.includes(t.name);
                  const atCap =
                    !active && draft.templates.length >= TEMPLATE_CAP;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => toggleDraftTemplate(t.name)}
                        disabled={atCap}
                        title={atCap ? `Limit ${TEMPLATE_CAP} templates` : t.name}
                        className={`w-full flex items-start justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-muted)] transition disabled:opacity-40 disabled:cursor-not-allowed ${active ? "text-[var(--accent)]" : ""}`}
                      >
                        <span className="font-mono text-[11px] leading-snug break-all flex-1 min-w-0">
                          {t.name}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          {!t.is_active && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--muted-2)]">
                              inactive
                            </span>
                          )}
                          {active && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-[11px]">
                <span className="text-[var(--muted-2)]">
                  {draft.templates.length}/{TEMPLATE_CAP} selected
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={clearDraftTemplates}
                    disabled={draft.templates.length === 0}
                    className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
                  >
                    Clear
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
            </div>
          )}
        </div>

        {/* Selected template chips */}
        {draft.templates.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-full">
            {draft.templates.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-mono"
                title={t}
              >
                <span className="truncate max-w-[200px]">{t}</span>
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => toggleDraftTemplate(t)}
                  className="rounded-full hover:bg-white/20 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Outcomes multi-select */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOutcomesOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[12px] hover:border-[var(--border-strong)] transition"
          >
            <span>Outcomes</span>
            {draft.outcomes.length > 0 && (
              <span className="rounded bg-[var(--accent)] px-1 py-0.5 text-[10px] font-medium text-[var(--accent-fg)]">
                {draft.outcomes.length}
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {outcomesOpen && (
            <div className="absolute left-0 mt-1 w-60 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] z-30 overflow-hidden">
              <ul className="max-h-60 overflow-y-auto py-1 text-[12px]">
                {KNOWN_OUTCOMES.map((o) => {
                  const active = draft.outcomes.includes(o);
                  return (
                    <li key={o}>
                      <button
                        type="button"
                        onClick={() => toggleDraftOutcome(o)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-muted)] transition ${active ? "text-[var(--accent)]" : ""}`}
                      >
                        <span className="font-mono text-[11px]">{o}</span>
                        {active && <Check className="h-3 w-3" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={clearDraftOutcomes}
                  disabled={draft.outcomes.length === 0}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomesOpen(false)}
                  className="font-medium text-[var(--accent)] hover:opacity-80"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected outcome chips */}
        {draft.outcomes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {draft.outcomes.map((o) => (
              <span
                key={o}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-medium font-mono"
              >
                {o}
                <button
                  type="button"
                  aria-label={`Remove ${o}`}
                  onClick={() => toggleDraftOutcome(o)}
                  className="rounded-full hover:bg-white/20 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <SavedViews />
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
          <button
            type="button"
            onClick={apply}
            className="inline-flex items-center gap-1.5 rounded-[7px] bg-[var(--accent)] px-3 py-1 text-[12px] font-medium text-[var(--accent-fg)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-strong)] transition"
          >
            Apply
          </button>
        </div>
      </div>
    </section>
  );
}

function Divider() {
  return (
    <span className="h-5 w-px bg-[var(--border)] mx-0.5" aria-hidden="true" />
  );
}
