import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../mcp/tools", () => ({
  sampleCalls: vi.fn(),
  getTranscriptsBatch: vi.fn(),
}));

import { sampleCalls, getTranscriptsBatch } from "../mcp/tools";
import { mineInsights, type ClaudeJson } from "./orchestrator";
import type { CallRef } from "../breeze/types";

const calls: CallRef[] = Array.from({ length: 4 }, (_, i) => ({
  leadId: String(i),
  callId: String(i),
  outcome: "RESOLVED",
  template: "t",
  startTime: "",
}));

describe("mineInsights", () => {
  beforeEach(() => {
    vi.mocked(sampleCalls).mockReset();
    vi.mocked(getTranscriptsBatch).mockReset();
  });

  it("samples, digests each chunk, then synthesizes insights", async () => {
    vi.mocked(sampleCalls).mockReturnValue(calls);
    vi.mocked(getTranscriptsBatch).mockResolvedValue(
      calls.map((c) => ({ leadId: c.leadId, transcription: "assistant: hi\nuser: refund" }))
    );

    const claude: ClaudeJson = vi
      .fn()
      .mockResolvedValueOnce({ findings: [{ tag: "hallucination", note: "made up price" }] })
      .mockResolvedValueOnce({
        insights: [
          {
            tag: "hallucination",
            headline: "Bot invents prices",
            frequency: 3,
            example: "…",
            suggestion: "Add a price-lookup guard to the template.",
          },
        ],
      });

    const out = await mineInsights(
      { calls, token: "tok", sampleSize: 4, chunkSize: 4, stratifyBy: "outcome" },
      claude
    );

    expect(sampleCalls).toHaveBeenCalledWith(calls, 4, "outcome");
    expect(out).toHaveLength(1);
    expect(out[0].headline).toBe("Bot invents prices");
    expect(out[0].tag).toBe("hallucination");
  });

  it("returns empty when there are no calls", async () => {
    vi.mocked(sampleCalls).mockReturnValue([]);
    const claude: ClaudeJson = vi.fn();
    const out = await mineInsights(
      { calls: [], token: "tok", sampleSize: 4, chunkSize: 4, stratifyBy: "outcome" },
      claude
    );
    expect(out).toEqual([]);
    expect(claude).not.toHaveBeenCalled();
  });
});
