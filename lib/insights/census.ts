import pLimit from "p-limit";
import { classifyCall, type ClassifyFn } from "./classify";
import { taxonomyFor } from "./reasonTaxonomy";
import type { CallInput, CallLabel } from "./types";
import type { LeadDetails } from "../breeze/client";

const CLASSIFY_CONCURRENCY = 8;
const FETCH_CHUNK = 25;

export type CensusDeps = {
  fetchBatch: (ids: string[], token: string) => Promise<LeadDetails[]>;
  classify: ClassifyFn;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runCensus(
  inputs: CallInput[],
  token: string,
  deps: CensusDeps
): Promise<CallLabel[]> {
  // 1. Fetch transcripts for the whole population, in chunks.
  const detailsById = new Map<string, LeadDetails>();
  for (const group of chunk(inputs, FETCH_CHUNK)) {
    const batch = await deps.fetchBatch(group.map((i) => i.leadId), token);
    for (const d of batch) detailsById.set(d.leadId, d);
  }

  // 2. Classify each call, concurrency-bounded.
  const limit = pLimit(CLASSIFY_CONCURRENCY);
  return Promise.all(
    inputs.map((input) =>
      limit(() => {
        const details =
          detailsById.get(input.leadId) ??
          { leadId: input.leadId, transcription: "", recordingUrl: "", error: "no transcript" };
        return classifyCall(input, details, taxonomyFor(input.template), deps.classify);
      })
    )
  );
}
