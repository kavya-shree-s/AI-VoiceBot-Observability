"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Filter,
  RotateCcw,
  Check,
  X,
  Layers,
  Search,
  Loader2,
} from "lucide-react";
import { PRESET_LABELS } from "@/lib/analytics/presets";
import type { PresetKey } from "@/lib/analytics/types";
import { useAnalyticsStore } from "../store";
import { useTemplates } from "../hooks";

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
  const setDraftTemplate = useAnalyticsStore((s) => s.setDraftTemplate);
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
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Filter className="h-4 w-4 text-[var(--muted)]" />
        Filters
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
            <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
            From
          </label>
          <input
            type="date"
            value={draft.date_from}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
            <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
            To
          </label>
          <input
            type="date"
            value={draft.date_to}
            onChange={(e) => setDraftTo(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--muted)] mb-1.5">
          Preset
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] transition"
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--muted)] mb-1.5">
          <Layers className="inline h-3 w-3 mr-1 -mt-0.5" />
          Template{" "}
          <span className="text-[var(--muted-2)]">(none = all)</span>
          {templatesLoading && (
            <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-[var(--accent)]" />
          )}
        </p>
        {draft.template && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[11px] font-medium">
              <span className="font-mono">{draft.template}</span>
              <button
                type="button"
                aria-label="Clear template"
                onClick={() => setDraftTemplate("")}
                className="rounded-full hover:bg-white/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setTemplatesOpen((v) => !v)}
          className="w-full inline-flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm hover:border-[var(--border-strong)] transition"
        >
          <span className="text-[var(--muted)] truncate">
            {draft.template
              ? `1 selected`
              : templates && templates.length > 0
                ? `Pick from ${templates.length} templates`
                : "No templates available"}
          </span>
          <Search className="h-3.5 w-3.5 text-[var(--muted-2)]" />
        </button>
        {templatesOpen && (
          <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
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
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setDraftTemplate("");
                    setTemplatesOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--accent-soft)] transition ${draft.template === "" ? "text-[var(--accent)]" : ""}`}
                >
                  <span className="text-xs italic">All templates</span>
                  {draft.template === "" && <Check className="h-3.5 w-3.5" />}
                </button>
              </li>
              {visibleTemplates.length === 0 && (
                <li className="px-3 py-2 text-xs text-[var(--muted-2)]">
                  {templatesError
                    ? `Couldn't load templates: ${(templatesError as Error).message}`
                    : "No templates match."}
                </li>
              )}
              {visibleTemplates.map((t) => {
                const active = draft.template === t.name;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftTemplate(t.name);
                        setTemplatesOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--accent-soft)] transition ${active ? "text-[var(--accent)]" : ""}`}
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
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--muted)] mb-1.5">
          Outcomes{" "}
          <span className="text-[var(--muted-2)]">(none = all)</span>
        </p>
        {draft.outcomes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {draft.outcomes.map((o) => (
              <span
                key={o}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[11px] font-medium"
              >
                <span className="font-mono">{o}</span>
                <button
                  type="button"
                  aria-label={`Remove ${o}`}
                  onClick={() => toggleDraftOutcome(o)}
                  className="rounded-full hover:bg-white/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOutcomesOpen((v) => !v)}
          className="w-full inline-flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm hover:border-[var(--border-strong)] transition"
        >
          <span className="text-[var(--muted)]">
            {draft.outcomes.length > 0
              ? `${draft.outcomes.length} selected`
              : `Pick from ${KNOWN_OUTCOMES.length} outcomes`}
          </span>
        </button>
        {outcomesOpen && (
          <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
            <ul className="max-h-60 overflow-y-auto py-1 text-sm">
              {KNOWN_OUTCOMES.map((o) => {
                const active = draft.outcomes.includes(o);
                return (
                  <li key={o}>
                    <button
                      type="button"
                      onClick={() => toggleDraftOutcome(o)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--accent-soft)] transition ${active ? "text-[var(--accent)]" : ""}`}
                    >
                      <span className="font-mono text-xs truncate">{o}</span>
                      {active && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-xs">
              <button
                type="button"
                onClick={clearDraftOutcomes}
                disabled={draft.outcomes.length === 0}
                className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
              >
                Clear all
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

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:border-[var(--border-strong)] transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <button
          type="button"
          onClick={apply}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium shadow-sm hover:opacity-90 transition"
        >
          Apply filters
        </button>
      </div>
    </section>
  );
}
