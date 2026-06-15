import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../leadFetcher", () => ({ fetchLead: vi.fn() }));

import { fetchLead } from "../leadFetcher";
import { fetchLeadDetailsBatch } from "./client";

describe("fetchLeadDetailsBatch", () => {
  beforeEach(() => vi.mocked(fetchLead).mockReset());

  it("returns transcript + recordingUrl per id", async () => {
    vi.mocked(fetchLead).mockResolvedValue({
      ok: true,
      data: {
        recording_url: "https://rec/1.mp3",
        metaData: { transcription: [{ role: "user", content: "hi" }] },
      },
    });
    const out = await fetchLeadDetailsBatch(["1"], "tok");
    expect(out[0]).toEqual({
      leadId: "1",
      transcription: "user: hi",
      recordingUrl: "https://rec/1.mp3",
    });
  });

  it("captures errors per id", async () => {
    vi.mocked(fetchLead).mockResolvedValue({ ok: false, message: "HTTP 404" });
    const out = await fetchLeadDetailsBatch(["1"], "tok");
    expect(out[0]).toEqual({
      leadId: "1",
      transcription: "",
      recordingUrl: "",
      error: "HTTP 404",
    });
  });
});
