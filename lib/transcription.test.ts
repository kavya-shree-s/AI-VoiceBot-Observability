import { describe, it, expect } from "vitest";
import {
  extractTranscription,
  extractTemplateId,
  extractCallEndedBy,
  extractRecordingUrl,
  filterByKeyword,
  toCsv,
  type TranscriptRow,
} from "./transcription";

const makeRow = (overrides: Partial<TranscriptRow> = {}): TranscriptRow => ({
  leadId: "lead-1",
  phone: "919343922922",
  name: "Ravi",
  callId: "abc-123",
  template: "tmpl",
  templateId: "tmpl-id",
  outcome: "RESOLVED",
  callEndedBy: "agent",
  startTime: "2026-05-25 13:48",
  recordingUrl: "https://x/rec.mp3",
  transcription: "assistant: hi\nuser: hello",
  ...overrides,
});

describe("extractTranscription", () => {
  it("keeps conversational turns and drops system/tool turns", () => {
    const lead = {
      metaData: {
        transcription: [
          { role: "system", content: "# IDENTITY long prompt" },
          { role: "assistant", content: "ನಮಸ್ಕಾರ ಸಾರಥಿ" },
          { role: "user", content: "rides sigthilla" },
          { role: "tool", content: "COMPLETED" },
        ],
      },
    };
    expect(extractTranscription(lead)).toBe(
      "assistant: ನಮಸ್ಕಾರ ಸಾರಥಿ\nuser: rides sigthilla"
    );
  });

  it("returns an empty string when there is no transcription array", () => {
    expect(extractTranscription({ metaData: {} })).toBe("");
    expect(extractTranscription({})).toBe("");
    expect(extractTranscription(null)).toBe("");
  });

  it("skips turns with non-string content", () => {
    const lead = {
      metaData: {
        transcription: [
          { role: "assistant", content: "hello" },
          { role: "assistant", content: null },
          { role: "user" },
        ],
      },
    };
    expect(extractTranscription(lead)).toBe("assistant: hello");
  });
});

describe("extractTemplateId", () => {
  it("reads template_id from the lead", () => {
    expect(extractTemplateId({ template_id: "15891b3f-tmpl" })).toBe(
      "15891b3f-tmpl"
    );
  });

  it("returns an empty string when template_id is missing", () => {
    expect(extractTemplateId({})).toBe("");
    expect(extractTemplateId(null)).toBe("");
  });
});

describe("extractCallEndedBy", () => {
  it("reads metaData.call_ended_by", () => {
    expect(extractCallEndedBy({ metaData: { call_ended_by: "agent" } })).toBe(
      "agent"
    );
  });

  it("returns an empty string when absent", () => {
    expect(extractCallEndedBy({ metaData: {} })).toBe("");
    expect(extractCallEndedBy(null)).toBe("");
  });
});

describe("extractRecordingUrl", () => {
  it("reads the top-level recording_url", () => {
    expect(
      extractRecordingUrl({ recording_url: "https://x/rec.mp3" })
    ).toBe("https://x/rec.mp3");
  });

  it("returns an empty string when absent", () => {
    expect(extractRecordingUrl({})).toBe("");
    expect(extractRecordingUrl(null)).toBe("");
  });
});

describe("filterByKeyword", () => {
  const rows = [
    makeRow({ callId: "a", transcription: "assistant: Sorry, technical issue aaytu" }),
    makeRow({ callId: "b", transcription: "assistant: ride sigthilla" }),
    makeRow({ callId: "c", transcription: "[error: HTTP 404 Not Found]" }),
  ];

  it("keeps only rows whose transcription contains the keyword, case-insensitively", () => {
    const result = filterByKeyword(rows, "TECHNICAL Issue");
    expect(result.map((r) => r.callId)).toEqual(["a"]);
  });

  it("returns all rows when the keyword is empty or whitespace", () => {
    expect(filterByKeyword(rows, "")).toHaveLength(3);
    expect(filterByKeyword(rows, "   ")).toHaveLength(3);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterByKeyword(rows, "nonsense")).toHaveLength(0);
  });
});

describe("toCsv", () => {
  const row: TranscriptRow = {
    leadId: "lead-1",
    phone: "919343922922",
    name: "Ravi",
    callId: "abc-123",
    template: "namma-yatri-block-support",
    templateId: "15891b3f-tmpl",
    outcome: "TRANSFERRED",
    callEndedBy: "agent",
    startTime: "2026-05-25 13:48",
    recordingUrl: "https://x/rec.mp3",
    transcription: "assistant: hi\nuser: hello",
  };

  it("writes a header row followed by one row per record", () => {
    const csv = toCsv([row]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "lead_id,phone,name,call_id,template,template_id,outcome,call_ended_by,start_time,recording_url,transcription"
    );
    expect(csv).toContain("919343922922");
    expect(csv).toContain("namma-yatri-block-support");
    expect(csv).toContain("15891b3f-tmpl");
    expect(csv).toContain("https://x/rec.mp3");
  });

  it("quotes and escapes fields containing commas, quotes, or newlines", () => {
    const tricky: TranscriptRow = {
      ...row,
      name: 'Ravi, "RJ"',
      transcription: "line1\nline2",
    };
    const csv = toCsv([tricky]);
    // embedded quotes are doubled, the whole field wrapped in quotes
    expect(csv).toContain('"Ravi, ""RJ"""');
    // a newline-containing field is wrapped in quotes
    expect(csv).toContain('"line1\nline2"');
  });
});
