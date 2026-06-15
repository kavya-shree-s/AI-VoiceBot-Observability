import { describe, it, expect, vi } from "vitest";
import { makeClaudeJson } from "./claude";

describe("makeClaudeJson", () => {
  it("calls messages.create with the model and parses JSON from the text block", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"findings":[{"tag":"hallucination","note":"x"}]}' }],
    });
    const claude = makeClaudeJson({ messages: { create } } as never);
    const out = (await claude("claude-sonnet-4-6", "sys", "user")) as {
      findings: unknown[];
    };
    expect(out.findings).toHaveLength(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-6", system: "sys" })
    );
  });

  it("throws a clear error when no JSON is present", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "no json here" }] });
    const claude = makeClaudeJson({ messages: { create } } as never);
    await expect(claude("m", "s", "u")).rejects.toThrow(/no JSON/i);
  });
});
