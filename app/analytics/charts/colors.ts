export const PALETTE = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#10b981",
  "#f97316",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#eab308",
];

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
