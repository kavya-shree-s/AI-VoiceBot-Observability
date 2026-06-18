import { describe, it, expect, vi } from "vitest";
import { runCensus } from "./census";
import type { CallInput } from "./types";
import type { LeadDetails } from "../breeze/client";

const inputs: CallInput[] = [
  { leadId: "1", callId: "c1", phone: "9991", name: "A", outcome: "TRANSFERRED", template: "driver-rides-block-support", startTime: "" },
  { leadId: "2", callId: "c2", phone: "9992", name: "B", outcome: "TRANSFERRED", template: "driver-rides-block-support", startTime: "" },
];

describe("runCensus", () => {
  it("fetches all, classifies each, returns one label per call", async () => {
    const fetchBatch = vi.fn(async (ids: string[]): Promise<LeadDetails[]> =>
      ids.map((leadId) => ({ leadId, transcription: "user: hi", recordingUrl: "" }))
    );
    const classify = vi.fn().mockResolvedValue({
      reasonCategory: "OUT_OF_SCOPE",
      reasonDetail: "Out-of-scope query",
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "hi",
    });

    const labels = await runCensus(inputs, "tok", { fetchBatch, classify });
    expect(labels).toHaveLength(2);
    expect(labels[0].reasonCategory).toBe("OUT_OF_SCOPE");
    expect(fetchBatch).toHaveBeenCalled();
  });
});
