"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowRight, Layers, Calendar, X } from "lucide-react";
import { useAnalyticsStore } from "./analytics/store";
import { useTemplates } from "./analytics/hooks";
import { PRESET_LABELS } from "@/lib/analytics/presets";
import type { PresetKey } from "@/lib/analytics/types";

type Action =
  | { kind: "jump"; label: string; tab: "extractor" | "analytics" }
  | { kind: "preset"; label: string; key: PresetKey }
  | { kind: "template"; label: string; name: string };

const PRESETS: PresetKey[] = ["today", "yesterday", "last7days", "last30days"];

export function CommandPalette({
  open,
  onClose,
  onSwitchTab,
}: {
  open: boolean;
  onClose: () => void;
  onSwitchTab: (tab: "extractor" | "analytics") => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: templates } = useTemplates();
  const applyPreset = useAnalyticsStore((s) => s.applyPreset);
  const setDraftTemplates = useAnalyticsStore((s) => s.setDraftTemplates);
  const apply = useAnalyticsStore((s) => s.apply);

  const actions = useMemo<Action[]>(() => {
    const all: Action[] = [
      { kind: "jump", label: "Go to Analytics", tab: "analytics" },
      { kind: "jump", label: "Go to Extractor", tab: "extractor" },
      ...PRESETS.map<Action>((p) => ({
        kind: "preset",
        label: `Set date range: ${PRESET_LABELS[p]}`,
        key: p,
      })),
      ...(templates ?? []).map<Action>((t) => ({
        kind: "template",
        label: `Filter by template: ${t.name}`,
        name: t.name,
      })),
    ];
    const query = q.trim().toLowerCase();
    if (!query) return all.slice(0, 20);
    return all.filter((a) => a.label.toLowerCase().includes(query)).slice(0, 20);
  }, [q, templates]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const execute = (a: Action) => {
    if (a.kind === "jump") onSwitchTab(a.tab);
    else if (a.kind === "preset") {
      applyPreset(a.key);
      apply();
      onSwitchTab("analytics");
    } else if (a.kind === "template") {
      setDraftTemplates([a.name]);
      apply();
      onSwitchTab("analytics");
    }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(actions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = actions[active];
      if (a) execute(a);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 pt-[10vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl rounded-[14px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
          <Search className="h-4 w-4 text-[var(--muted-2)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actions, templates, presets…"
            className="flex-1 bg-transparent text-[14px] focus:outline-none placeholder:text-[var(--muted-2)]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted-2)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1 text-[13px]">
          {actions.length === 0 && (
            <li className="px-4 py-6 text-center text-[12px] text-[var(--muted-2)]">
              No matches.
            </li>
          )}
          {actions.map((a, i) => (
            <li key={`${a.kind}-${i}-${a.label}`}>
              <button
                type="button"
                onClick={() => execute(a)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
                  i === active
                    ? "bg-[var(--surface-muted)] text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {a.kind === "jump" && <ArrowRight className="h-3.5 w-3.5" />}
                {a.kind === "preset" && <Calendar className="h-3.5 w-3.5" />}
                {a.kind === "template" && <Layers className="h-3.5 w-3.5" />}
                <span className="truncate flex-1">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--muted-2)]">
          <span>
            <kbd className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono">↑↓</kbd>{" "}
            navigate ·{" "}
            <kbd className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono">↵</kbd>{" "}
            run ·{" "}
            <kbd className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono">esc</kbd>{" "}
            close
          </span>
          <span>Cmd/Ctrl + K</span>
        </footer>
      </div>
    </div>
  );
}
