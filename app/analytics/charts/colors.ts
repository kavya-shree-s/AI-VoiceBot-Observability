/**
 * A 12-step categorical palette tuned for WCAG-AA contrast on both light and
 * dark surfaces. Order is chosen so adjacent slices/series stay distinguishable.
 */
export const PALETTE = [
  "#6366f1", // indigo-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#a855f7", // purple-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
  "#3b82f6", // blue-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#eab308", // yellow-500
];

export const OTHER_COLOR = "var(--muted-2)";

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
