export type AnalyticsType =
  | "outcome-counts"
  | "performance"
  | "call-based"
  | "lead-based"
  | "lead-status-counts"
  | "conversion"
  | "outbound-numbers";

export type TimeGranularity = "day" | "week" | "month";

export type DateRange = { from: string; to: string };

export type AnalyticsFilters = {
  date_from: string;
  date_to: string;
  outcomes?: string[];
};

export type AnalyticsOptions = {
  page?: number;
  limit?: number;
  time_granularity?: TimeGranularity;
};

export type OutcomeCount = {
  outcome: string;
  count: number;
  percentage: number;
};

export type OutcomeCountsData = {
  type: "outcome-counts";
  filters_applied: Record<string, unknown>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  results: OutcomeCount[];
  page_total_calls: number;
};

export type OutcomeStat = { count: number; percentage: number };

export type PerformanceData = {
  type: "performance";
  filters_applied: Record<string, unknown>;
  results: {
    total_calls: number;
    success_rate: number;
    answer_rate: number;
    failure_rate: number;
    average_duration: number;
    total_cost: number | null;
    cost_per_success: number | null;
    call_breakdown: {
      picked: number;
      no_answer: number;
      busy: number;
      failed: number;
    };
    outcome_distribution: Record<string, OutcomeStat>;
  };
};

export type CallBasedBucket = {
  total_calls: number;
  completed_calls: number;
  failed_calls: number;
  success_rate: number;
  average_duration: number;
  outcome_breakdown: Record<string, number>;
  date?: string;
};

export type CallBasedData = {
  type: "call-based";
  time_granularity: TimeGranularity | null;
  results: CallBasedBucket[];
};

export type AnalyticsEnvelope<T> = {
  success: boolean;
  data: T;
  error: string | null;
};

export type PresetKey =
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "thismonth"
  | "previousmonth";
