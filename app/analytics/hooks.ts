"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth-context";
import { useAnalyticsStore } from "./store";
import type {
  AnalyticsType,
  AnalyticsOptions,
  CallBasedData,
  OutcomeCountsData,
  PerformanceData,
} from "@/lib/analytics/types";

class AuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthError";
  }
}

async function fetchAnalytics<T>(
  token: string,
  type: AnalyticsType,
  filters: Record<string, unknown>,
  options: AnalyticsOptions,
  onAuthFail: () => void
): Promise<T> {
  const res = await fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, type, filters, options }),
  });
  if (res.status === 401 || res.status === 403) {
    onAuthFail();
    throw new AuthError();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : undefined) ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!data || !data.success) {
    throw new Error(data?.error ?? "Analytics request failed");
  }
  return data.data as T;
}

function useAppliedFilters() {
  return useAnalyticsStore((s) => s.applied);
}

export function usePerformance() {
  const { token, signOut } = useAuth();
  const filters = useAppliedFilters();
  return useQuery({
    queryKey: ["analytics", "performance", filters],
    enabled: !!token,
    retry: (count, err) => err instanceof AuthError ? false : count < 1,
    queryFn: () =>
      fetchAnalytics<PerformanceData>(
        token!,
        "performance",
        toApiFilters(filters),
        {},
        () => signOut({ expired: true })
      ),
  });
}

export function useOutcomeCounts(page: number, limit: number) {
  const { token, signOut } = useAuth();
  const filters = useAppliedFilters();
  return useQuery({
    queryKey: ["analytics", "outcome-counts", filters, page, limit],
    enabled: !!token,
    retry: (count, err) => err instanceof AuthError ? false : count < 1,
    queryFn: () =>
      fetchAnalytics<OutcomeCountsData>(
        token!,
        "outcome-counts",
        toApiFilters(filters),
        { page, limit },
        () => signOut({ expired: true })
      ),
  });
}

export function useCallBasedTrend(granularity: "day" | "week" | "month") {
  const { token, signOut } = useAuth();
  const filters = useAppliedFilters();
  return useQuery({
    queryKey: ["analytics", "call-based", filters, granularity],
    enabled: !!token,
    retry: (count, err) => err instanceof AuthError ? false : count < 1,
    queryFn: () =>
      fetchAnalytics<CallBasedData>(
        token!,
        "call-based",
        toApiFilters(filters),
        { time_granularity: granularity },
        () => signOut({ expired: true })
      ),
  });
}

function toApiFilters(f: {
  date_from: string;
  date_to: string;
  outcomes: string[];
  template: string;
}) {
  const out: Record<string, unknown> = {
    date_from: f.date_from,
    date_to: f.date_to,
  };
  if (f.outcomes.length > 0) out.outcomes = f.outcomes;
  if (f.template) out.template = f.template;
  return out;
}

export type TemplateOption = { id: string; name: string; is_active: boolean };

export function useTemplates() {
  const { token, signOut } = useAuth();
  return useQuery({
    queryKey: ["templates"],
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: (count, err) => (err instanceof AuthError ? false : count < 1),
    queryFn: async (): Promise<TemplateOption[]> => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 401 || res.status === 403) {
        signOut({ expired: true });
        throw new AuthError();
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : undefined) ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return ((data?.templates as TemplateOption[]) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    },
  });
}
