"use client";

import { AlertCircle } from "lucide-react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-2 px-2 py-3" role="status" aria-label={label}>
      <div className="skeleton h-3 w-1/3" />
      <div className="skeleton h-3 w-2/3" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-[10px] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyBox({ label }: { label: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--border)] px-3 py-8 text-center text-caption text-[var(--muted)]">
      {label}
    </div>
  );
}
