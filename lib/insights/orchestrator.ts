import { sampleCalls, getTranscriptsBatch } from "../mcp/tools";
import type { CallRef } from "../breeze/types";

export type QualitativeInsight = {
  tag: string;
  headline: string;
  frequency: number;
  example: string;
  suggestion: string;
};

/** Injected Claude call: takes (model, system, user) and returns parsed JSON. */
export type ClaudeJson = (
  model: string,
  system: string,
  user: string
) => Promise<unknown>;

export type MineOptions = {
  calls: CallRef[];
  token: string;
  sampleSize: number;
  chunkSize: number;
  stratifyBy: "outcome" | "template";
};

const MAP_MODEL = "claude-sonnet-4-6";
const REDUCE_MODEL = "claude-opus-4-8";

const DIGEST_SYSTEM =
  "You analyze AI voice-bot call transcripts. For the given transcripts, list recurring problems. " +
  'Reply ONLY with JSON: {"findings":[{"tag":string,"note":string}]}. ' +
  "Each tag must be a failure-mode value (e.g. hallucination, section_sequencing).";

const SYNTH_SYSTEM =
  "You synthesize per-chunk findings about AI voice-bot calls into the top recurring failure modes. " +
  'Reply ONLY with JSON: {"insights":[{"tag":string,"headline":string,"frequency":number,' +
  '"example":string,"suggestion":string}]}. Each suggestion is a concrete template improvement.';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function mineInsights(
  opts: MineOptions,
  claude: ClaudeJson
): Promise<QualitativeInsight[]> {
  const sample = sampleCalls(opts.calls, opts.sampleSize, opts.stratifyBy);
  if (sample.length === 0) return [];

  const allFindings: unknown[] = [];
  for (const group of chunk(sample, opts.chunkSize)) {
    const transcripts = await getTranscriptsBatch(
      group.map((c) => c.leadId),
      opts.token
    );
    const usable = transcripts.filter((t) => !t.error && t.transcription);
    if (usable.length === 0) continue;
    const user = usable
      .map((t) => `--- call ${t.leadId} ---\n${t.transcription}`)
      .join("\n\n");
    const digest = (await claude(MAP_MODEL, DIGEST_SYSTEM, user)) as {
      findings?: unknown[];
    };
    if (Array.isArray(digest?.findings)) allFindings.push(...digest.findings);
  }

  if (allFindings.length === 0) return [];

  const synth = (await claude(
    REDUCE_MODEL,
    SYNTH_SYSTEM,
    JSON.stringify(allFindings)
  )) as { insights?: QualitativeInsight[] };

  return Array.isArray(synth?.insights) ? synth.insights : [];
}
