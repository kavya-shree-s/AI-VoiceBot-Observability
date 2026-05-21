import type { JobProgress, JobStatus, RecordingError } from "./types";

export type Job = JobProgress & {
  createdAt: number;
  zip?: Buffer;
  errors: RecordingError[];
};

const JOB_TTL_MS = 60 * 60 * 1000;
const store = new Map<string, Job>();

function gc() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of store) {
    if (job.createdAt < cutoff) store.delete(id);
  }
}

export function createJob(id: string, total: number): Job {
  gc();
  const job: Job = {
    id,
    status: "pending",
    total,
    completed: 0,
    failed: 0,
    createdAt: Date.now(),
    errors: [],
  };
  store.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return store.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  const next: Job = { ...existing, ...patch };
  store.set(id, next);
  return next;
}

export function setJobStatus(
  id: string,
  status: JobStatus,
  errorMessage?: string
) {
  return updateJob(id, { status, errorMessage });
}

export function deleteJob(id: string) {
  store.delete(id);
}
