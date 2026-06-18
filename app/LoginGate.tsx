"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  LogIn,
  User,
  Lock,
} from "lucide-react";
import { useAuth } from "./auth-context";

export function LoginGate() {
  const { signIn, sessionExpired } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Login failed (${res.status})`);
      }
      signIn(data.token as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <div className="space-y-5">
        <header className="space-y-2 text-center">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[var(--accent-fg)] mx-auto">
            <Sparkles className="h-4 w-4" />
          </div>
          <h1 className="text-h1">Sign in to Breeze Buddy</h1>
          <p className="text-[13px] text-[var(--muted)]">
            Use your Breeze Buddy credentials to continue.
          </p>
        </header>

        <section
          className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]"
          style={{ borderRadius: "var(--radius-lg)" }}
        >
          {sessionExpired && !error && (
            <p className="mb-4 flex items-start gap-2 rounded-[8px] border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-[13px] text-[var(--warning)]">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Your session expired. Please sign in again.</span>
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label
                htmlFor="username"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]"
              >
                <User className="h-3 w-3" />
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--accent)] transition"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]"
              >
                <Lock className="h-3 w-3" />
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--accent)] transition"
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 text-[12px] text-[var(--danger)]">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-strong)] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
