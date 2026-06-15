"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth-context";
import { useAnalyticsStore } from "./store";
import { priorPeriod } from "@/lib/analytics/periods";
import {
  mergeCallBased,
  mergeOutcomeCounts,
  mergePerformance,
} from "@/lib/analytics/merge";
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

type BaseFilters = {
  date_from: string;
  date_to: string;
  outcomes: string[];
};

function toApiFilters(f: BaseFilters & { template?: string }) {
  const out: Record<string, unknown> = {
    date_from: f.date_from,
    date_to: f.date_to,
  };
  if (f.outcomes.length > 0) out.outcomes = f.outcomes;
  if (f.template) out.template = f.template;
  return out;
}

/**
 * Build the list of "subjects" to query — one query per selected template,
 * or a single query with no template filter when none are selected.
 */
function subjectsFor(templates: string[]): Array<string | undefined> {
  return templates.length === 0 ? [undefined] : templates;
}

/** A single React-Query subscription per (subject, type, filters) tuple. */
function buildQuery<T>(
  token: string | null,
  type: AnalyticsType,
  filters: BaseFilters,
  template: string | undefined,
  options: AnalyticsOptions,
  onAuthFail: () => void,
  extraKey: unknown[] = []
) {
  return {
    queryKey: [
      "analytics",
      type,
      { ...filters, template: template ?? "" },
      ...extraKey,
    ] as const,
    enabled: !!token,
    retry: (count: number, err: unknown) =>
      err instanceof AuthError ? false : count < 1,
    queryFn: () =>
      fetchAnalytics<T>(
        token!,
        type,
        toApiFilters({ ...filters, template }),
        options,
        onAuthFail
      ),
  };
}

export function usePerformance() {
  const { token, signOut } = useAuth();
  const filters = useAppliedFilters();
  const subjects = subjectsFor(filters.templates);

  const queries = useQueries({
    queries: subjects.map((t) =>
      buildQuery<PerformanceData>(
        token,
        "performance",
        filters,
        t,
        {},
        () => signOut({ expired: true })
      )
    ),
  });

  return useAggregated(queries, mergePerformance);
}

export function usePerformancePrev() {
  const { token, signOut } = useAuth();
  const filters = useAppliedFilters();
  const prev = priorPeriod({ from: filters.date_from, to: filters.date_to });
  const prevFilters: BaseFilters = {
    date_from: prev.from,
    date_to: prev.to,
    outcomes: filters.outcomes,
  };
  const subjects = subjectsFor(filters.templates);

  const queries = useQueries({
    queries: subjects.map((t) =>
      buildQuery<PerformanceData>(
        token,
        "performance",
        prevFilters,
        t,
        {},
        () => signOut({ expired: true }),
        ["prev"]
      )
    ),
  });

  return useAggregated(queries, mergePerformance);
}

const MULTI_FETCH_LIMIT = 200;

export function useOutcomeCounts(page: number, limit: number) {
  const { token, signOut } = useAuth();
  const filters = useAppliedFilters();
  const isMulti = filters.templates.length > 1;
  const subjects = subjectsFor(filters.templates);

  const queries = useQueries({
    queries: subjects.map((t) =>
      buildQuery<OutcomeCountsData>(
        token,
        "outcome-counts",
        filters,
        t,
        // For multi-template, fetch a generous page so we have everything to merge.
        isMulti ? { page: 1, limit: MULTI_FETCH_LIMIT } : { page, limit },
        () => signOut({ expired: true }),
        // Page only matters for the single-template path; for multi we always grab page 1.
        isMulti ? ["multi"] : [page, limit]
      )
    ),
  });

  const aggregated = useAggregated(queries, mergeOutcomeCounts);

  // For multi-template, paginate the merged result client-side.
  const data = useMemo(() => {
    if (!aggregated.data || !isMulti) return aggregated.data;
    const total = aggregated.data.results.length;
    const start = (page - 1) * limit;
    const slice = aggregated.data.results.slice(start, start + limit);
    return {
      ...aggregated.data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
      results: slice,
    };
  }, [aggregated.data, isMulti, page, limit]);

  return { ...aggregated, data };
}

export function useCallBasedTrend(granularity: "day" | "week" | "month") {
  const { token, signOut } = useAuth();
  const filters = useAppliedFilters();
  const subjects = subjectsFor(filters.templates);

  const queries = useQueries({
    queries: subjects.map((t) =>
      buildQuery<CallBasedData>(
        token,
        "call-based",
        filters,
        t,
        { time_granularity: granularity },
        () => signOut({ expired: true }),
        [granularity]
      )
    ),
  });

  return useAggregated(queries, mergeCallBased);
}

/**
 * Collapses a list of parallel React-Query results into a single result with a
 * merged data value (when all queries have settled).
 */
type QResult<T> = {
  data?: T;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
};

function useAggregated<T>(
  queries: QResult<T>[],
  merge: (parts: T[]) => T
): { data: T | undefined; isLoading: boolean; isFetching: boolean; error: Error | null } {
  const parts = queries.map((q) => q.data);
  const allSettled = parts.every((d) => d !== undefined);
  // Merge is cheap (sum counts over <=N×outcomes); recomputing per render is fine.
  // React Query keeps part references stable when data is unchanged.
  const data = allSettled ? merge(parts as T[]) : undefined;

  const firstError = queries.find((q) => q.error)?.error;
  return {
    data,
    isLoading: queries.some((q) => q.isLoading),
    isFetching: queries.some((q) => q.isFetching),
    error: firstError ? (firstError as Error) : null,
  };
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
