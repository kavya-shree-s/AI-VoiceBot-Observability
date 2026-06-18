"use client";

import { create } from "zustand";
import { presetRange } from "@/lib/analytics/presets";
import type { DateRange, PresetKey } from "@/lib/analytics/types";

export type FiltersState = {
  date_from: string;
  date_to: string;
  outcomes: string[];
  templates: string[]; // empty = all templates
};

export const TEMPLATE_CAP = 10;

type AnalyticsState = {
  draft: FiltersState;
  applied: FiltersState;
  setDraftFrom: (v: string) => void;
  setDraftTo: (v: string) => void;
  toggleDraftOutcome: (o: string) => void;
  clearDraftOutcomes: () => void;
  toggleDraftTemplate: (name: string) => void;
  setDraftTemplates: (names: string[]) => void;
  clearDraftTemplates: () => void;
  applyPreset: (key: PresetKey) => void;
  apply: () => void;
  reset: () => void;
};

function makeDefault(): FiltersState {
  const r: DateRange = presetRange("last7days", new Date());
  return { date_from: r.from, date_to: r.to, outcomes: [], templates: [] };
}

export const useAnalyticsStore = create<AnalyticsState>((set) => {
  const initial = makeDefault();
  return {
    draft: initial,
    applied: initial,
    setDraftFrom: (v) =>
      set((s) => ({ draft: { ...s.draft, date_from: v } })),
    setDraftTo: (v) => set((s) => ({ draft: { ...s.draft, date_to: v } })),
    toggleDraftOutcome: (o) =>
      set((s) => ({
        draft: {
          ...s.draft,
          outcomes: s.draft.outcomes.includes(o)
            ? s.draft.outcomes.filter((x) => x !== o)
            : [...s.draft.outcomes, o],
        },
      })),
    clearDraftOutcomes: () =>
      set((s) => ({ draft: { ...s.draft, outcomes: [] } })),
    toggleDraftTemplate: (name) =>
      set((s) => {
        const current = s.draft.templates;
        if (current.includes(name)) {
          return {
            draft: { ...s.draft, templates: current.filter((x) => x !== name) },
          };
        }
        if (current.length >= TEMPLATE_CAP) return {};
        return { draft: { ...s.draft, templates: [...current, name] } };
      }),
    setDraftTemplates: (names) =>
      set((s) => ({
        draft: { ...s.draft, templates: names.slice(0, TEMPLATE_CAP) },
      })),
    clearDraftTemplates: () =>
      set((s) => ({ draft: { ...s.draft, templates: [] } })),
    applyPreset: (key) => {
      const r = presetRange(key, new Date());
      set((s) => ({
        draft: { ...s.draft, date_from: r.from, date_to: r.to },
      }));
    },
    apply: () => set((s) => ({ applied: s.draft })),
    reset: () => {
      const next = makeDefault();
      set({ draft: next, applied: next });
    },
  };
});
