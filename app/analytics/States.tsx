"use client";

import { Loader2, AlertCircle } from "lucide-react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyBox({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-10 text-center text-sm text-[var(--muted)]">
      {label}
    </div>
  );
}
