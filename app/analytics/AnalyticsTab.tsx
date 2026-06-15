"use client";

import { FiltersPanel } from "./filters/FiltersPanel";
import { KpiCards } from "./summary/KpiCards";
import { OutcomePie } from "./charts/OutcomePie";
import { OutcomeBar } from "./charts/OutcomeBar";
import { OutcomeStackedArea } from "./charts/OutcomeStackedArea";
import { OutcomePercentageTrend } from "./charts/OutcomePercentageTrend";
import { CombinedOutcomeTrend } from "./charts/CombinedOutcomeTrend";
import { OutcomesTable } from "./table/OutcomesTable";
import { Insights } from "./Insights";

export function AnalyticsTab() {
  return (
    <div className="space-y-3">
      {/* Filter strip */}
      <FiltersPanel />

      {/* Row 1: KPI cards */}
      <KpiCards />

      {/* Row 2: 60 / 40 split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3">
          <OutcomePie />
        </div>
        <div className="lg:col-span-2">
          <Insights />
        </div>
      </div>

      {/* Row 3: full-width composition trend */}
      <OutcomeStackedArea />

      {/* Row 3.5: per-outcome growth + combined-outcome share, side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <OutcomePercentageTrend />
        <CombinedOutcomeTrend />
      </div>

      {/* Row 4: bar chart + table side-by-side on wide screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <OutcomeBar />
        <OutcomesTable />
      </div>
    </div>
  );
}
