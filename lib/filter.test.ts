import { describe, it, expect } from "vitest";
import { filterRows, uniqueOutcomes, uniqueTemplates } from "./filter";
import type { CsvRow } from "./types";

const makeRow = (overrides: Partial<CsvRow> = {}): CsvRow => ({
  leadId: "lead1",
  callId: "call1",
  template: "t",
  name: "Alice",
  mobile: "111",
  startTime: "2026-05-20 14:30:00",
  endTime: "2026-05-20 14:31:00",
  duration: "60",
  outcome: "RESOLVED",
  metadata: "",
  attemptCount: "1",
  record: "",
  ...overrides,
});

describe("filterRows", () => {
  it("drops rows with empty callId", () => {
    const rows = [makeRow({ callId: "" }), makeRow({ callId: "k" })];
    expect(filterRows(rows, {}).length).toBe(1);
  });

  it("filters by outcome when provided", () => {
    const rows = [
      makeRow({ outcome: "RESOLVED" }),
      makeRow({ outcome: "DRIVER_NOT_FOUND", callId: "c2" }),
      makeRow({ outcome: "RESOLVED", callId: "c3" }),
    ];
    const out = filterRows(rows, { outcomes: ["RESOLVED"] });
    expect(out.length).toBe(2);
    expect(out.every((r) => r.outcome === "RESOLVED")).toBe(true);
  });

  it("returns all when outcomes is empty array", () => {
    const rows = [
      makeRow({ outcome: "A" }),
      makeRow({ outcome: "B", callId: "c2" }),
    ];
    expect(filterRows(rows, { outcomes: [] }).length).toBe(2);
  });

  it("filters by start/end date inclusive", () => {
    const rows = [
      makeRow({ startTime: "2026-05-19 12:00:00", callId: "c1" }),
      makeRow({ startTime: "2026-05-20 12:00:00", callId: "c2" }),
      makeRow({ startTime: "2026-05-21 12:00:00", callId: "c3" }),
    ];
    const out = filterRows(rows, {
      startDate: "2026-05-20",
      endDate: "2026-05-20",
    });
    expect(out.length).toBe(1);
    expect(out[0].callId).toBe("c2");
  });

  it("excludes rows with unparseable startTime when date filter active", () => {
    const rows = [makeRow({ startTime: "not-a-date" })];
    const out = filterRows(rows, { startDate: "2026-05-20" });
    expect(out.length).toBe(0);
  });

  it("ignores startTime when no date filter is applied", () => {
    const rows = [makeRow({ startTime: "" })];
    expect(filterRows(rows, {}).length).toBe(1);
  });
});

describe("filterRows - template + mobile", () => {
  it("filters by template name", () => {
    const rows = [
      makeRow({ template: "a-driver", callId: "c1" }),
      makeRow({ template: "b-customer", callId: "c2" }),
      makeRow({ template: "a-driver", callId: "c3" }),
    ];
    const out = filterRows(rows, { templates: ["a-driver"] });
    expect(out.map((r) => r.callId)).toEqual(["c1", "c3"]);
  });

  it("returns all when templates is empty array", () => {
    const rows = [
      makeRow({ template: "a", callId: "c1" }),
      makeRow({ template: "b", callId: "c2" }),
    ];
    expect(filterRows(rows, { templates: [] }).length).toBe(2);
  });

  it("filters by mobile substring, ignoring non-digit chars in query", () => {
    const rows = [
      makeRow({ mobile: "918088981258", callId: "c1" }),
      makeRow({ mobile: "919945910464", callId: "c2" }),
      makeRow({ mobile: "919086378326", callId: "c3" }),
    ];
    const out = filterRows(rows, { mobileSubstring: "9945" });
    expect(out.map((r) => r.callId)).toEqual(["c2"]);
    const out2 = filterRows(rows, { mobileSubstring: "+91 80" });
    expect(out2.map((r) => r.callId)).toEqual(["c1"]);
  });

  it("ignores empty mobile substring", () => {
    const rows = [makeRow({ mobile: "111", callId: "c1" })];
    expect(filterRows(rows, { mobileSubstring: "" }).length).toBe(1);
  });

  it("combines template + mobile filters", () => {
    const rows = [
      makeRow({ template: "a", mobile: "111", callId: "c1" }),
      makeRow({ template: "a", mobile: "222", callId: "c2" }),
      makeRow({ template: "b", mobile: "111", callId: "c3" }),
    ];
    const out = filterRows(rows, { templates: ["a"], mobileSubstring: "111" });
    expect(out.map((r) => r.callId)).toEqual(["c1"]);
  });
});

describe("uniqueTemplates", () => {
  it("returns sorted unique non-empty templates", () => {
    const rows = [
      makeRow({ template: "b", callId: "c1" }),
      makeRow({ template: "a", callId: "c2" }),
      makeRow({ template: "", callId: "c3" }),
      makeRow({ template: "a", callId: "c4" }),
    ];
    expect(uniqueTemplates(rows)).toEqual(["a", "b"]);
  });
});

describe("uniqueOutcomes", () => {
  it("returns sorted unique outcomes, skipping empty", () => {
    const rows = [
      makeRow({ outcome: "B" }),
      makeRow({ outcome: "A", callId: "c2" }),
      makeRow({ outcome: "", callId: "c3" }),
      makeRow({ outcome: "A", callId: "c4" }),
    ];
    expect(uniqueOutcomes(rows)).toEqual(["A", "B"]);
  });
});
