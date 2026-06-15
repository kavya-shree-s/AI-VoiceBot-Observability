"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Sparkles,
  RefreshCcw,
  Monitor,
  Sun,
  Moon,
  User,
  LogOut,
  Calendar,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { useTheme, type ThemeChoice } from "./ThemeProvider";
import { useAnalyticsStore } from "./analytics/store";

type TabKey = "extractor" | "analytics";

export function TopBar({
  tab,
  onTabChange,
  onOpenPalette,
}: {
  tab: TabKey;
  onTabChange: (next: TabKey) => void;
  onOpenPalette: () => void;
}) {
  const { signOut } = useAuth();
  const { choice, setChoice } = useTheme();
  const queryClient = useQueryClient();
  const applied = useAnalyticsStore((s) => s.applied);
  const [userOpen, setUserOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  /* Cmd/Ctrl-K opens the palette */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenPalette]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md"
      role="banner"
    >
      <div className="mx-auto w-full max-w-[1600px] flex items-center gap-3 px-4 sm:px-6 h-12">
        {/* Branding */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-fg)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">
            Breeze Buddy
          </span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-0.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
          <TabButton active={tab === "extractor"} onClick={() => onTabChange("extractor")}>
            Extractor
          </TabButton>
          <TabButton active={tab === "analytics"} onClick={() => onTabChange("analytics")}>
            Analytics
          </TabButton>
        </nav>

        {/* Search trigger */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="ml-3 inline-flex flex-1 max-w-md items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[12px] text-[var(--muted)] hover:border-[var(--border-strong)] transition"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left truncate">Search…</span>
          <kbd className="rounded bg-[var(--surface)] border border-[var(--border)] px-1 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Date range chip (visible when on Analytics) */}
          {tab === "analytics" && (
            <button
              type="button"
              onClick={onOpenPalette}
              className="hidden md:inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-[12px] text-[var(--muted)] hover:border-[var(--border-strong)] transition"
              title="Change date range"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {applied.date_from} → {applied.date_to}
              </span>
            </button>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh analytics"
            className="inline-flex items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] h-7 w-7 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>

          {/* Theme */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeOpen((v) => !v)}
              aria-label="Theme"
              className="inline-flex items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] h-7 w-7 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition"
            >
              {choice === "dark" ? (
                <Moon className="h-3.5 w-3.5" />
              ) : choice === "light" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Monitor className="h-3.5 w-3.5" />
              )}
            </button>
            {themeOpen && (
              <div className="absolute right-0 mt-1 w-36 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] z-30 py-1 text-[12px]">
                {(
                  [
                    { v: "system", label: "System", Icon: Monitor },
                    { v: "light", label: "Light", Icon: Sun },
                    { v: "dark", label: "Dark", Icon: Moon },
                  ] as Array<{ v: ThemeChoice; label: string; Icon: React.ComponentType<{ className?: string }> }>
                ).map(({ v, label, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setChoice(v);
                      setThemeOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-muted)] ${
                      choice === v ? "text-[var(--accent)]" : ""
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              aria-label="User menu"
              className="inline-flex items-center justify-center rounded-full bg-[var(--surface-muted)] border border-[var(--border)] h-7 w-7 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition"
            >
              <User className="h-3.5 w-3.5" />
            </button>
            {userOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] z-30 py-1 text-[12px]">
                <button
                  type="button"
                  onClick={() => {
                    setUserOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-[5px] text-[12px] font-medium transition ${
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-sm)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

