import { describe, it, expect } from "vitest";
import { buildAudioFilename, sanitizeFilenamePart } from "./sanitize";

describe("sanitizeFilenamePart", () => {
  it("removes path-unsafe characters", () => {
    expect(sanitizeFilenamePart("a/b\\c:d*e?f\"g<h>i|j")).toBe("abcdefghij");
  });
  it("collapses whitespace to underscore", () => {
    expect(sanitizeFilenamePart("  hello  world  ")).toBe("hello_world");
  });
  it("returns empty string for null/undefined", () => {
    expect(sanitizeFilenamePart(null)).toBe("");
    expect(sanitizeFilenamePart(undefined)).toBe("");
  });
  it("caps length at 80 chars", () => {
    expect(sanitizeFilenamePart("a".repeat(200)).length).toBe(80);
  });
});

describe("buildAudioFilename", () => {
  it("uses mobile_name_callId pattern with .mp3", () => {
    expect(
      buildAudioFilename({
        mobile: "919945910464",
        name: "RAJU",
        callId: "abc-123",
      })
    ).toBe("919945910464_RAJU_abc-123.mp3");
  });
  it("substitutes 'unknown' when name is empty", () => {
    expect(
      buildAudioFilename({ mobile: "918088981258", name: "", callId: "x" })
    ).toBe("918088981258_unknown_x.mp3");
  });
  it("substitutes 'unknown' when mobile is empty", () => {
    expect(
      buildAudioFilename({ mobile: "", name: "Alice", callId: "x" })
    ).toBe("unknown_Alice_x.mp3");
  });
});
