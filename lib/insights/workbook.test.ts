import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook } from "./workbook";
import type { CallLabel } from "./types";

const labels: CallLabel[] = [
  {
    callId: "1", phone: "9991", name: "RAJU", startTime: "2026-06-11",
    reasonCategory: "OUT_OF_SCOPE", reasonDetail: "Out-of-scope query",
    driverClaimedOnline: false, explicitHuman: true,
    lastUserTurn: "x", snippet: "y", nTurns: 3, recordingUrl: "https://rec/1.mp3",
  },
];

describe("buildWorkbook", () => {
  it("produces a buffer with the expected sheets and Per_call rows", async () => {
    const buf = await buildWorkbook(labels, {
      reportDate: "2026-06-11",
      template: "driver-rides-block-support",
    });
    expect(buf.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(
      expect.arrayContaining(["Summary", "Reason_breakdown", "Per_call"])
    );
    const perCall = wb.getWorksheet("Per_call")!;
    expect(perCall.rowCount).toBe(2);
  });
});
