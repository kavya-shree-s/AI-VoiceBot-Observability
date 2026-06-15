import { describe, it, expect } from "vitest";
import { reasonBreakdown, summary, qaSubset } from "./aggregate";
import type { CallLabel } from "./types";

function label(p: Partial<CallLabel>): CallLabel {
  return {
    callId: "c", phone: "", name: "", startTime: "",
    reasonCategory: "OUT_OF_SCOPE", reasonDetail: "Out-of-scope query",
    driverClaimedOnline: false, explicitHuman: false,
    lastUserTurn: "", snippet: "", nTurns: 1, recordingUrl: "",
    ...p,
  };
}

const labels: CallLabel[] = [
  label({ callId: "1", reasonCategory: "TEST_RIDE_VERIFY_FAILED", reasonDetail: "Test-ride failed: notification not received" }),
  label({ callId: "2", reasonCategory: "TEST_RIDE_VERIFY_FAILED", reasonDetail: "Test-ride failed: notification not received" }),
  label({ callId: "3", reasonCategory: "OUT_OF_SCOPE", reasonDetail: "Out-of-scope query", explicitHuman: true }),
  label({ callId: "4", reasonCategory: "UNCLASSIFIED", reasonDetail: "Could not classify", error: "HTTP 404" }),
];

describe("reasonBreakdown", () => {
  it("counts each (category, detail) with exact % of total, sorted desc", () => {
    const rows = reasonBreakdown(labels);
    expect(rows[0]).toEqual({
      category: "TEST_RIDE_VERIFY_FAILED",
      detail: "Test-ride failed: notification not received",
      calls: 2,
      pct: 50,
    });
    const totalCalls = rows.reduce((s, r) => s + r.calls, 0);
    expect(totalCalls).toBe(4);
    const pctSum = rows.reduce((s, r) => s + r.pct, 0);
    expect(Math.round(pctSum)).toBe(100);
  });
});

describe("summary", () => {
  it("reports totals, biggest category, and explicit-human count", () => {
    const s = summary(labels, { reportDate: "2026-06-11", template: "driver-rides-block-support" });
    expect(s.totalCalls).toBe(4);
    expect(s.biggestCategory.category).toBe("TEST_RIDE_VERIFY_FAILED");
    expect(s.biggestCategory.calls).toBe(2);
    expect(s.explicitHuman).toBe(1);
    expect(s.unclassified).toBe(1);
  });
});

describe("qaSubset", () => {
  it("filters labels by predicate", () => {
    const qa = qaSubset(labels, (l) => l.reasonDetail.includes("notification not received"));
    expect(qa).toHaveLength(2);
  });
});
