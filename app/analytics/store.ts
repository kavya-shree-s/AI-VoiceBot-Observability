"use client";

import { create } from "zustand";
import { presetRange } from "@/lib/analytics/presets";
import type { DateRange, PresetKey } from "@/lib/analytics/types";

export type FiltersState = {
  date_from: string;
  date_to: string;
  outcomes: string[];
  template: string; // empty string = all templates
};

type AnalyticsState = {
  draft: FiltersState;
  applied: FiltersState;
  setDraftFrom: (v: string) => void;
  setDraftTo: (v: string) => void;
  toggleDraftOutcome: (o: string) => void;
  clearDraftOutcomes: () => void;
  setDraftTemplate: (name: string) => void;
  applyPreset: (key: PresetKey) => void;
  apply: () => void;
  reset: () => void;
};

function makeDefault(): FiltersState {
  const r: DateRange = presetRange("last7days", new Date());
  return { date_from: r.from, date_to: r.to, outcomes: [], template: "" };
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
    setDraftTemplate: (name) =>
      set((s) => ({ draft: { ...s.draft, template: name } })),
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
