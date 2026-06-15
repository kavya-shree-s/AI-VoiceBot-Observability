import pLimit from "p-limit";
import { fetchLead } from "../leadFetcher";
import { extractTranscription, extractRecordingUrl } from "../transcription";
import type { TranscriptResult } from "./types";

const CONCURRENCY = 5;
export const MAX_BATCH = 25;

/** Fetches several transcripts live, bounded + concurrency-limited, errors collected. */
export async function fetchTranscriptsBatch(
  ids: string[],
  token: string
): Promise<TranscriptResult[]> {
  const bounded = ids.slice(0, MAX_BATCH);
  const limit = pLimit(CONCURRENCY);
  return Promise.all(
    bounded.map((leadId) =>
      limit(async (): Promise<TranscriptResult> => {
        const res = await fetchLead(leadId, token);
        if (!res.ok) return { leadId, transcription: "", error: res.message };
        return { leadId, transcription: extractTranscription(res.data) };
      })
    )
  );
}

function snippetAround(text: string, q: string, pad = 60): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text.slice(0, pad * 2);
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + q.length + pad);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export type SearchHit = { leadId: string; snippet: string };

/** Fetches transcripts and returns only those containing keyword, with a snippet. */
export async function searchTranscripts(
  ids: string[],
  keyword: string,
  token: string
): Promise<SearchHit[]> {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  const batch = await fetchTranscriptsBatch(ids, token);
  return batch
    .filter((b) => !b.error && b.transcription.toLowerCase().includes(q))
    .map((b) => ({ leadId: b.leadId, snippet: snippetAround(b.transcription, q) }));
}

export type LeadDetails = {
  leadId: string;
  transcription: string;
  recordingUrl: string;
  error?: string;
};

/** Like fetchTranscriptsBatch but also returns the recording URL (for Per_call).
 *  Not capped at MAX_BATCH — the census loops the whole population; concurrency
 *  is bounded via CONCURRENCY. */
export async function fetchLeadDetailsBatch(
  ids: string[],
  token: string
): Promise<LeadDetails[]> {
  const limit = pLimit(CONCURRENCY);
  return Promise.all(
    ids.map((leadId) =>
      limit(async (): Promise<LeadDetails> => {
        const res = await fetchLead(leadId, token);
        if (!res.ok) {
          return { leadId, transcription: "", recordingUrl: "", error: res.message };
        }
        return {
          leadId,
          transcription: extractTranscription(res.data),
          recordingUrl: extractRecordingUrl(res.data),
        };
      })
    )
  );
}

const ANALYTICS_URL =
  process.env.BREEZE_ANALYTICS_URL ??
  "https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/analytics";

/** Proxies the Breeze /analytics endpoint for quantitative grounding. */
export async function fetchOutcomeStats(
  type: string,
  filters: Record<string, unknown>,
  token: string
): Promise<unknown> {
  const res = await fetch(ANALYTICS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, filters, options: {} }),
  });
  if (!res.ok) throw new Error(`Analytics upstream ${res.status}`);
  return res.json();
}
