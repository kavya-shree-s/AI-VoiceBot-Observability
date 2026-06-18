import {
  fetchTranscriptsBatch,
  searchTranscripts,
  fetchOutcomeStats,
  type SearchHit,
} from "../breeze/client";
import { stratifiedSample } from "../breeze/sample";
import type { CallRef, TranscriptResult } from "../breeze/types";

export function listCalls(calls: CallRef[]): CallRef[] {
  return calls.map(({ leadId, callId, outcome, template, startTime }) => ({
    leadId,
    callId,
    outcome,
    template,
    startTime,
  }));
}

export function sampleCalls(
  calls: CallRef[],
  n: number,
  stratifyBy: "outcome" | "template"
): CallRef[] {
  return stratifiedSample(calls, n, stratifyBy);
}

export function getTranscriptsBatch(
  ids: string[],
  token: string
): Promise<TranscriptResult[]> {
  return fetchTranscriptsBatch(ids, token);
}

export function search(
  ids: string[],
  keyword: string,
  token: string
): Promise<SearchHit[]> {
  return searchTranscripts(ids, keyword, token);
}

export function outcomeStats(
  type: string,
  filters: Record<string, unknown>,
  token: string
): Promise<unknown> {
  return fetchOutcomeStats(type, filters, token);
}
