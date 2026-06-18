import { describe, it, expect, vi } from "vitest";
import { classifyCall, type ClassifyFn } from "./classify";
import { taxonomyFor } from "./reasonTaxonomy";
import type { CallInput, LeadDetails } from "./classify";

const tax = taxonomyFor("driver-rides-block-support");
const input: CallInput = {
  leadId: "1", callId: "c1", phone: "9991", name: "RAJU",
  outcome: "TRANSFERRED", template: "driver-rides-block-support", startTime: "2026-06-11",
};
const details: LeadDetails = {
  leadId: "1",
  transcription: "assistant: hi\nuser: notification ಬರ್ತಾ ಇಲ್ಲ",
  recordingUrl: "https://rec/1.mp3",
};

describe("classifyCall", () => {
  it("maps a valid raw label and derives nTurns/lastUserTurn in code", async () => {
    const fn: ClassifyFn = vi.fn().mockResolvedValue({
      reasonCategory: "TEST_RIDE_VERIFY_FAILED",
      reasonDetail: "Test-ride failed: notification not received",
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "notification ಬರ್ತಾ ಇಲ್ಲ",
    });
    const out = await classifyCall(input, details, tax, fn);
    expect(out.reasonCategory).toBe("TEST_RIDE_VERIFY_FAILED");
    expect(out.nTurns).toBe(2);
    expect(out.lastUserTurn).toBe("notification ಬರ್ತಾ ಇಲ್ಲ");
    expect(out.recordingUrl).toBe("https://rec/1.mp3");
    expect(out.error).toBeUndefined();
  });

  it("coerces an out-of-taxonomy label to UNCLASSIFIED", async () => {
    const fn: ClassifyFn = vi.fn().mockResolvedValue({
      reasonCategory: "MADE_UP",
      reasonDetail: "nonsense",
      driverClaimedOnline: false,
      explicitHuman: true,
      snippet: "x",
    });
    const out = await classifyCall(input, details, tax, fn);
    expect(out.reasonCategory).toBe("UNCLASSIFIED");
    expect(out.explicitHuman).toBe(true);
  });

  it("marks an errored fetch as UNCLASSIFIED with the error", async () => {
    const fn: ClassifyFn = vi.fn();
    const out = await classifyCall(
      input,
      { leadId: "1", transcription: "", recordingUrl: "", error: "HTTP 404" },
      tax,
      fn
    );
    expect(out.error).toBe("HTTP 404");
    expect(out.reasonCategory).toBe("UNCLASSIFIED");
    expect(fn).not.toHaveBeenCalled();
  });
});
