import { describe, it, expect } from "vitest";
import { stratifiedSample } from "./sample";
import type { CallRef } from "./types";

function ref(leadId: string, outcome: string): CallRef {
  return { leadId, callId: leadId, outcome, template: "t", startTime: "" };
}

describe("stratifiedSample", () => {
  it("returns all calls when n >= population", () => {
    const calls = [ref("1", "RESOLVED"), ref("2", "TRANSFERRED")];
    expect(stratifiedSample(calls, 5, "outcome")).toHaveLength(2);
  });

  it("returns empty for n<=0 or empty input", () => {
    expect(stratifiedSample([ref("1", "RESOLVED")], 0, "outcome")).toEqual([]);
    expect(stratifiedSample([], 5, "outcome")).toEqual([]);
  });

  it("spreads the sample across strata (round-robin), not all from one group", () => {
    const calls = [
      ref("a1", "RESOLVED"), ref("a2", "RESOLVED"), ref("a3", "RESOLVED"),
      ref("b1", "TRANSFERRED"), ref("b2", "TRANSFERRED"),
    ];
    const out = stratifiedSample(calls, 2, "outcome");
    expect(out).toHaveLength(2);
    const outcomes = new Set(out.map((c) => c.outcome));
    expect(outcomes.size).toBe(2); // one from each stratum
  });

  it("is deterministic for the same input", () => {
    const calls = [ref("a1", "X"), ref("a2", "X"), ref("b1", "Y")];
    expect(stratifiedSample(calls, 2, "outcome")).toEqual(
      stratifiedSample(calls, 2, "outcome")
    );
  });
});
