import type Anthropic from "@anthropic-ai/sdk";
import { flatDetails, type Taxonomy } from "./reasonTaxonomy";
import type { ClassifyFn, RawLabel } from "./classify";

const SYSTEM =
  "You classify a single AI voice-bot call transcript into the reason it was transferred " +
  "to a human. Use ONLY the provided category and detail values. Also judge whether the " +
  "driver claimed to be online, and whether they explicitly demanded a human at any point. " +
  "Pick the verbatim snippet (may be Kannada) that best evidences the reason.";

export function makeHaikuClassifier(client: Anthropic): ClassifyFn {
  return async (transcript, tax: Taxonomy): Promise<RawLabel> => {
    const categories = tax.map((c) => c.category);
    const details = flatDetails(tax);
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Categories: ${JSON.stringify(categories)}\n` +
            `Details: ${JSON.stringify(details)}\n\n` +
            `Transcript:\n${transcript}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          name: "call_label",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reasonCategory: { type: "string", enum: categories },
              reasonDetail: { type: "string", enum: details },
              driverClaimedOnline: { type: "boolean" },
              explicitHuman: { type: "boolean" },
              snippet: { type: "string" },
            },
            required: [
              "reasonCategory",
              "reasonDetail",
              "driverClaimedOnline",
              "explicitHuman",
              "snippet",
            ],
          },
        },
      },
    } as never);
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return JSON.parse(text) as RawLabel;
  };
}
