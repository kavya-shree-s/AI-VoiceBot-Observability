import { describe, it, expect } from "vitest";
import { countTurns, lastUserTurn } from "./transcript";

const t = "assistant: hello\nuser: ನಮಸ್ಕಾರ\nassistant: how can I help\nuser: refund please";

describe("transcript helpers", () => {
  it("countTurns counts non-empty role lines", () => {
    expect(countTurns(t)).toBe(4);
    expect(countTurns("")).toBe(0);
  });

  it("lastUserTurn returns the last user line content verbatim", () => {
    expect(lastUserTurn(t)).toBe("refund please");
    expect(lastUserTurn("assistant: hi")).toBe("");
  });
});
