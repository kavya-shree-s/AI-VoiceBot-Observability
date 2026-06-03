import { describe, it, expect } from "vitest";
import { presetRange, formatDate } from "./presets";

const ANCHOR = new Date(2026, 5, 15); // June 15, 2026 (local)

describe("formatDate", () => {
  it("renders a Date as YYYY-MM-DD using local fields", () => {
    expect(formatDate(new Date(2026, 0, 2))).toBe("2026-01-02");
    expect(formatDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("presetRange", () => {
  it("today: from == to == today", () => {
    expect(presetRange("today", ANCHOR)).toEqual({
      from: "2026-06-15",
      to: "2026-06-15",
    });
  });

  it("yesterday: single previous day", () => {
    expect(presetRange("yesterday", ANCHOR)).toEqual({
      from: "2026-06-14",
      to: "2026-06-14",
    });
  });

  it("last7days: trailing 7-day window ending today", () => {
    expect(presetRange("last7days", ANCHOR)).toEqual({
      from: "2026-06-09",
      to: "2026-06-15",
    });
  });

  it("last30days: trailing 30-day window ending today", () => {
    expect(presetRange("last30days", ANCHOR)).toEqual({
      from: "2026-05-17",
      to: "2026-06-15",
    });
  });

  it("thismonth: first of current month to today", () => {
    expect(presetRange("thismonth", ANCHOR)).toEqual({
      from: "2026-06-01",
      to: "2026-06-15",
    });
  });

  it("previousmonth: first to last day of previous month", () => {
    expect(presetRange("previousmonth", ANCHOR)).toEqual({
      from: "2026-05-01",
      to: "2026-05-31",
    });
  });

  it("handles year boundaries for previousmonth in January", () => {
    expect(presetRange("previousmonth", new Date(2026, 0, 10))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
