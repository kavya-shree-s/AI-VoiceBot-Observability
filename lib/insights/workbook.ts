import ExcelJS from "exceljs";
import type { CallLabel } from "./types";
import { reasonBreakdown, summary } from "./aggregate";

export async function buildWorkbook(
  labels: CallLabel[],
  opts: { reportDate: string; template: string }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const s = summary(labels, opts);
  const sum = wb.addWorksheet("Summary");
  sum.addRow(["Metric", "Value"]);
  sum.addRow(["Report date", s.reportDate]);
  sum.addRow(["Template", s.template]);
  sum.addRow(["Total calls", s.totalCalls]);
  sum.addRow([
    "Biggest reason category",
    `${s.biggestCategory.category} (${s.biggestCategory.calls}, ${s.biggestCategory.pct}%)`,
  ]);
  sum.addRow(["Explicit human demand (any point)", s.explicitHuman]);
  sum.addRow(["Unclassified", s.unclassified]);

  const br = wb.addWorksheet("Reason_breakdown");
  br.addRow(["Category", "Reason", "calls", "% of total"]);
  for (const r of reasonBreakdown(labels)) {
    br.addRow([r.category, r.detail, r.calls, r.pct]);
  }

  const pc = wb.addWorksheet("Per_call");
  pc.addRow([
    "call_id", "phone", "name", "reason_category", "reason_detail",
    "driver_claimed_online", "explicit_human", "n_turns", "last_user_turn",
    "start_time", "recording_url", "error",
  ]);
  for (const l of labels) {
    pc.addRow([
      l.callId, l.phone, l.name, l.reasonCategory, l.reasonDetail,
      l.driverClaimedOnline, l.explicitHuman, l.nTurns, l.lastUserTurn,
      l.startTime, l.recordingUrl, l.error ?? "",
    ]);
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
