"use client";

import { FiltersPanel } from "./filters/FiltersPanel";
import { KpiCards } from "./summary/KpiCards";
import { OutcomePie } from "./charts/OutcomePie";
import { OutcomeBar } from "./charts/OutcomeBar";
import { DailyTrendLine } from "./charts/DailyTrendLine";
import { OutcomeStackedArea } from "./charts/OutcomeStackedArea";
import { OutcomesTable } from "./table/OutcomesTable";

export function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <FiltersPanel />
      <KpiCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OutcomePie />
        <OutcomeBar />
      </div>
      <DailyTrendLine />
      <OutcomeStackedArea />
      <OutcomesTable />
    </div>
  );
}
