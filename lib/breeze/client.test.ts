import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../leadFetcher", () => ({
  fetchLead: vi.fn(),
}));

import { fetchLead } from "../leadFetcher";
import { fetchTranscriptsBatch, searchTranscripts, MAX_BATCH } from "./client";

const lead = (turns: Array<{ role: string; content: string }>) => ({
  ok: true as const,
  data: { metaData: { transcription: turns } },
});

describe("fetchTranscriptsBatch", () => {
  beforeEach(() => vi.mocked(fetchLead).mockReset());

  it("returns cleaned transcripts keyed by leadId", async () => {
    vi.mocked(fetchLead).mockResolvedValue(
      lead([{ role: "assistant", content: "hi" }, { role: "user", content: "hello" }])
    );
    const out = await fetchTranscriptsBatch(["1", "2"], "tok");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ leadId: "1", transcription: "assistant: hi\nuser: hello" });
  });

  it("collects per-id errors instead of throwing", async () => {
    vi.mocked(fetchLead).mockResolvedValue({ ok: false, message: "HTTP 500" });
    const out = await fetchTranscriptsBatch(["1"], "tok");
    expect(out[0]).toEqual({ leadId: "1", transcription: "", error: "HTTP 500" });
  });

  it("bounds the batch to MAX_BATCH ids", async () => {
    vi.mocked(fetchLead).mockResolvedValue(lead([{ role: "user", content: "x" }]));
    const ids = Array.from({ length: MAX_BATCH + 5 }, (_, i) => String(i));
    const out = await fetchTranscriptsBatch(ids, "tok");
    expect(out).toHaveLength(MAX_BATCH);
  });
});

describe("searchTranscripts", () => {
  beforeEach(() => vi.mocked(fetchLead).mockReset());

  it("returns only matches with a snippet, case-insensitive", async () => {
    vi.mocked(fetchLead)
      .mockResolvedValueOnce(lead([{ role: "user", content: "I want a REFUND please" }]))
      .mockResolvedValueOnce(lead([{ role: "user", content: "thanks" }]));
    const out = await searchTranscripts(["1", "2"], "refund", "tok");
    expect(out).toHaveLength(1);
    expect(out[0].leadId).toBe("1");
    expect(out[0].snippet.toLowerCase()).toContain("refund");
  });
});
