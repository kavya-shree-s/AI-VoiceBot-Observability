import type Anthropic from "@anthropic-ai/sdk";
import type { ClaudeJson } from "./orchestrator";

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude returned no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

/** Wraps an Anthropic client into the orchestrator's ClaudeJson contract. */
export function makeClaudeJson(client: Anthropic): ClaudeJson {
  return async (model, system, user) => {
    const res = await client.messages.create({
      model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return extractJson(text);
  };
}
