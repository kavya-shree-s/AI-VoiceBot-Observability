import type { FiltersState } from "../../app/analytics/store";

export type SavedView = {
  id: string;
  name: string;
  filters: FiltersState;
  createdAt: string;
};

export function addView(views: SavedView[], next: SavedView): SavedView[] {
  const filtered = views.filter((v) => v.id !== next.id);
  return [next, ...filtered];
}

export function removeView(views: SavedView[], id: string): SavedView[] {
  return views.filter((v) => v.id !== id);
}

const PREFIX = "breeze-savedViews:";

export function load(namespace: string): SavedView[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + namespace);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedView[];
  } catch {
    return [];
  }
}

export function persist(namespace: string, views: SavedView[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFIX + namespace, JSON.stringify(views));
  } catch {
    /* quota or disabled — ignore */
  }
}
