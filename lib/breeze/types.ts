/** Minimal call reference the app already holds from the call_details_*.csv. */
export type CallRef = {
  leadId: string;
  callId: string;
  outcome: string;
  template: string;
  startTime: string;
};

/** Result of fetching one transcript live from Breeze. */
export type TranscriptResult = {
  leadId: string;
  transcription: string;
  error?: string;
};
