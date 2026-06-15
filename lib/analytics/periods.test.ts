import { describe, it, expect } from "vitest";
import { priorPeriod } from "./periods";

describe("priorPeriod", () => {
  it("returns the immediately preceding window of equal length", () => {
    expect(priorPeriod({ from: "2026-05-28", to: "2026-06-03" })).toEqual({
      from: "2026-05-21",
      to: "2026-05-27",
    });
  });

  it("handles single-day ranges", () => {
    expect(priorPeriod({ from: "2026-06-03", to: "2026-06-03" })).toEqual({
      from: "2026-06-02",
      to: "2026-06-02",
    });
  });

  it("crosses month boundaries", () => {
    expect(priorPeriod({ from: "2026-06-01", to: "2026-06-07" })).toEqual({
      from: "2026-05-25",
      to: "2026-05-31",
    });
  });

  it("crosses year boundaries", () => {
    expect(priorPeriod({ from: "2026-01-01", to: "2026-01-07" })).toEqual({
      from: "2025-12-25",
      to: "2025-12-31",
    });
  });
});
