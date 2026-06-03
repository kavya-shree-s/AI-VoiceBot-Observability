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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <div className="space-y-6">
        <header className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] shadow-sm">
            <Sparkles className="h-3 w-3 text-[var(--accent)]" />
            Breeze Buddy · Recording Extractor
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-[var(--muted)]">
            Use your Breeze Buddy credentials to continue.
          </p>
        </header>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm">
          {sessionExpired && !error && (
            <p className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--warning)]">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Your session expired. Please sign in again.</span>
            </p>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"
              >
                <User className="h-3.5 w-3.5" />
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"
              >
                <Lock className="h-3.5 w-3.5" />
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 text-sm text-[var(--danger)]">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
