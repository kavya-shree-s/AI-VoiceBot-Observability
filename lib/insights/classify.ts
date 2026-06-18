import { countTurns, lastUserTurn } from "./transcript";
import { isValidLabel, UNCLASSIFIED, type Taxonomy } from "./reasonTaxonomy";
import type { CallInput, CallLabel } from "./types";
import type { LeadDetails } from "../breeze/client";

export type { CallInput } from "./types";
export type { LeadDetails } from "../breeze/client";

/** The raw label the LLM returns (before code-side reconciliation). */
export type RawLabel = {
  reasonCategory: string;
  reasonDetail: string;
  driverClaimedOnline: boolean;
  explicitHuman: boolean;
  snippet: string;
};

/** Injected classifier: given a transcript + taxonomy, returns a raw label. */
export type ClassifyFn = (transcript: string, tax: Taxonomy) => Promise<RawLabel>;

export async function classifyCall(
  input: CallInput,
  details: LeadDetails,
  tax: Taxonomy,
  classify: ClassifyFn
): Promise<CallLabel> {
  const base = {
    callId: input.callId,
    phone: input.phone,
    name: input.name,
    startTime: input.startTime,
    nTurns: countTurns(details.transcription),
    lastUserTurn: lastUserTurn(details.transcription),
    recordingUrl: details.recordingUrl,
  };

  if (details.error || !details.transcription.trim()) {
    return {
      ...base,
      reasonCategory: UNCLASSIFIED.category,
      reasonDetail: UNCLASSIFIED.detail,
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "",
      error: details.error ?? "empty transcript",
    };
  }

  try {
    const raw = await classify(details.transcription, tax);
    const valid = isValidLabel(tax, raw.reasonCategory, raw.reasonDetail);
    return {
      ...base,
      reasonCategory: valid ? raw.reasonCategory : UNCLASSIFIED.category,
      reasonDetail: valid ? raw.reasonDetail : UNCLASSIFIED.detail,
      driverClaimedOnline: Boolean(raw.driverClaimedOnline),
      explicitHuman: Boolean(raw.explicitHuman),
      snippet: raw.snippet ?? "",
    };
  } catch (e) {
    return {
      ...base,
      reasonCategory: UNCLASSIFIED.category,
      reasonDetail: UNCLASSIFIED.detail,
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
