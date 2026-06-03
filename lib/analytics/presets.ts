import type { DateRange, PresetKey } from "./types";

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function presetRange(key: PresetKey, today: Date): DateRange {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (key) {
    case "today":
      return { from: formatDate(t), to: formatDate(t) };
    case "yesterday": {
      const y = addDays(t, -1);
      return { from: formatDate(y), to: formatDate(y) };
    }
    case "last7days":
      return { from: formatDate(addDays(t, -6)), to: formatDate(t) };
    case "last30days":
      return { from: formatDate(addDays(t, -29)), to: formatDate(t) };
    case "thismonth": {
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      return { from: formatDate(first), to: formatDate(t) };
    }
    case "previousmonth": {
      const firstOfThis = new Date(t.getFullYear(), t.getMonth(), 1);
      const lastOfPrev = addDays(firstOfThis, -1);
      const firstOfPrev = new Date(
        lastOfPrev.getFullYear(),
        lastOfPrev.getMonth(),
        1
      );
      return { from: formatDate(firstOfPrev), to: formatDate(lastOfPrev) };
    }
  }
}

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7days: "Last 7 Days",
  last30days: "Last 30 Days",
  thismonth: "This Month",
  previousmonth: "Previous Month",
};
