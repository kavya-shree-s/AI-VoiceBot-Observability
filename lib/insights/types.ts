/** One call to classify — richer than CallRef so Per_call can show phone/name. */
export type CallInput = {
  leadId: string;
  callId: string;
  phone: string;
  name: string;
  outcome: string;
  template: string;
  startTime: string;
};

/** A call after classification (or with an error if it could not be classified). */
export type CallLabel = {
  callId: string;
  phone: string;
  name: string;
  startTime: string;
  reasonCategory: string;
  reasonDetail: string;
  driverClaimedOnline: boolean;
  explicitHuman: boolean;
  lastUserTurn: string;
  snippet: string;
  nTurns: number;
  recordingUrl: string;
  error?: string;
};
