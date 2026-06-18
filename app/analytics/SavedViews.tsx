"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Plus, Trash2, ChevronDown } from "lucide-react";
import { useAnalyticsStore } from "./store";
import {
  addView,
  load,
  persist,
  removeView,
  type SavedView,
} from "@/lib/analytics/savedViews";

const NS = "default";

export function SavedViews() {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [views, setViews] = useState<SavedView[]>([]);

  const draft = useAnalyticsStore((s) => s.draft);
  const apply = useAnalyticsStore((s) => s.apply);
  const setDraftFrom = useAnalyticsStore((s) => s.setDraftFrom);
  const setDraftTo = useAnalyticsStore((s) => s.setDraftTo);
  const setDraftTemplates = useAnalyticsStore((s) => s.setDraftTemplates);
  const toggleDraftOutcome = useAnalyticsStore((s) => s.toggleDraftOutcome);
  const clearDraftOutcomes = useAnalyticsStore((s) => s.clearDraftOutcomes);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setViews(load(NS));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useCallback(() => {
    const n = name.trim();
    if (!n) return;
    const view: SavedView = {
      id: `${n}-${Math.floor(performance.now())}`,
      name: n,
      filters: draft,
      createdAt: new Date().toISOString(),
    };
    const next = addView(views, view);
    setViews(next);
    persist(NS, next);
    setName("");
    setNaming(false);
  }, [name, draft, views]);

  const restore = (v: SavedView) => {
    setDraftFrom(v.filters.date_from);
    setDraftTo(v.filters.date_to);
    // Backward-compat for views saved when only one template could be picked.
    const legacy = (v.filters as unknown as { template?: string }).template;
    const next = v.filters.templates ?? (legacy ? [legacy] : []);
    setDraftTemplates(next);
    clearDraftOutcomes();
    for (const o of v.filters.outcomes ?? []) toggleDraftOutcome(o);
    apply();
    setOpen(false);
  };

  const remove = (id: string) => {
    const next = removeView(views, id);
    setViews(next);
    persist(NS, next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] hover:border-[var(--border-strong)] transition"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Views
        {views.length > 0 && (
          <span className="ml-1 rounded bg-[var(--surface-muted)] px-1 tabular-nums">
            {views.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-72 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] z-30">
          <div className="border-b border-[var(--border)] px-3 py-2">
            {naming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="View name"
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-[var(--accent-fg)]"
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="inline-flex w-full items-center gap-1.5 rounded-md py-1 text-[12px] text-[var(--foreground)] hover:text-[var(--accent)] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Save current filters as a view
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto py-1 text-[12px]">
            {views.length === 0 && (
              <li className="px-3 py-3 text-[var(--muted-2)] text-center">
                No saved views yet.
              </li>
            )}
            {views.map((v) => (
              <li
                key={v.id}
                className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-muted)]"
              >
                <button
                  type="button"
                  onClick={() => restore(v)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-[10px] text-[var(--muted-2)]">
                    {v.filters.date_from} → {v.filters.date_to}
                    {v.filters.templates && v.filters.templates.length > 0
                      ? ` · ${v.filters.templates.length} template${v.filters.templates.length === 1 ? "" : "s"}`
                      : ""}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(v.id)}
                  aria-label={`Delete ${v.name}`}
                  className="opacity-0 group-hover:opacity-100 transition rounded p-1 text-[var(--muted-2)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
