export type CsvRow = {
  leadId: string;
  callId: string;
  template: string;
  name: string;
  mobile: string;
  startTime: string;
  endTime: string;
  duration: string;
  outcome: string;
  metadata: string;
  attemptCount: string;
  record: string;
};

export type JobStatus = "pending" | "running" | "done" | "error";

export type JobProgress = {
  id: string;
  status: JobStatus;
  total: number;
  completed: number;
  failed: number;
  errorMessage?: string;
};

export type RecordingError = {
  callId: string;
  filename: string;
  httpStatus?: number;
  message: string;
};
