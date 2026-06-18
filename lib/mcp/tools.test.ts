import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../breeze/client", () => ({
  fetchTranscriptsBatch: vi.fn(),
  searchTranscripts: vi.fn(),
  fetchOutcomeStats: vi.fn(),
}));

import {
  fetchTranscriptsBatch,
  searchTranscripts,
  fetchOutcomeStats,
} from "../breeze/client";
import { listCalls, sampleCalls, getTranscriptsBatch, search, outcomeStats } from "./tools";
import type { CallRef } from "../breeze/types";

const calls: CallRef[] = [
  { leadId: "1", callId: "c1", outcome: "RESOLVED", template: "t1", startTime: "" },
  { leadId: "2", callId: "c2", outcome: "TRANSFERRED", template: "t2", startTime: "" },
];

describe("mcp tool logic", () => {
  beforeEach(() => {
    vi.mocked(fetchTranscriptsBatch).mockReset();
    vi.mocked(searchTranscripts).mockReset();
    vi.mocked(fetchOutcomeStats).mockReset();
  });

  it("listCalls returns metadata only (no transcript field)", () => {
    const out = listCalls(calls);
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty("transcription");
    expect(out[0].outcome).toBe("RESOLVED");
  });

  it("sampleCalls delegates to stratified sampling", () => {
    const out = sampleCalls(calls, 1, "outcome");
    expect(out).toHaveLength(1);
  });

  it("getTranscriptsBatch delegates to the breeze client", async () => {
    vi.mocked(fetchTranscriptsBatch).mockResolvedValue([
      { leadId: "1", transcription: "assistant: hi" },
    ]);
    const out = await getTranscriptsBatch(["1"], "tok");
    expect(out[0].transcription).toBe("assistant: hi");
    expect(fetchTranscriptsBatch).toHaveBeenCalledWith(["1"], "tok");
  });

  it("search delegates to searchTranscripts", async () => {
    vi.mocked(searchTranscripts).mockResolvedValue([{ leadId: "1", snippet: "…refund…" }]);
    const out = await search(["1"], "refund", "tok");
    expect(out[0].leadId).toBe("1");
  });

  it("outcomeStats delegates to fetchOutcomeStats", async () => {
    vi.mocked(fetchOutcomeStats).mockResolvedValue({ total_calls: 10 });
    const out = await outcomeStats("performance", {}, "tok");
    expect(out).toEqual({ total_calls: 10 });
  });
});
