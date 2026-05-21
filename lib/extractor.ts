import archiver from "archiver";
import pLimit from "p-limit";
import { PassThrough } from "node:stream";
import { fetchRecording } from "./fetcher";
import { updateJob, setJobStatus, getJob } from "./jobStore";
import type { RecordingError } from "./types";

export type ExtractItem = {
  callId: string;
  filename: string;
};

const CONCURRENCY = 8;

export async function runExtraction(
  jobId: string,
  token: string,
  items: ExtractItem[]
) {
  setJobStatus(jobId, "running");

  const archive = archiver("zip", { zlib: { level: 6 } });
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", (c: Buffer) => chunks.push(c));
  const sinkEnded = new Promise<void>((resolve, reject) => {
    sink.on("end", () => resolve());
    sink.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(sink);

  const errors: RecordingError[] = [];
  const limit = pLimit(CONCURRENCY);
  let completed = 0;
  let failed = 0;

  await Promise.all(
    items.map((item) =>
      limit(async () => {
        const result = await fetchRecording(item.callId, token);
        if (result.ok) {
          archive.append(result.data, { name: item.filename });
          completed += 1;
        } else {
          failed += 1;
          errors.push({
            callId: item.callId,
            filename: item.filename,
            httpStatus: result.httpStatus,
            message: result.message,
          });
        }
        updateJob(jobId, { completed, failed });
      })
    )
  );

  if (errors.length > 0) {
    const header = "Call ID,Filename,HTTP Status,Message\n";
    const body = errors
      .map(
        (e) =>
          `${csv(e.callId)},${csv(e.filename)},${csv(
            e.httpStatus?.toString() ?? ""
          )},${csv(e.message)}`
      )
      .join("\n");
    archive.append(Buffer.from(header + body, "utf-8"), {
      name: "_errors.csv",
    });
  }

  await archive.finalize();
  await sinkEnded;

  const zip = Buffer.concat(chunks);
  updateJob(jobId, { zip, errors, status: "done" });
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function safeRun(jobId: string, token: string, items: ExtractItem[]) {
  runExtraction(jobId, token, items).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    const job = getJob(jobId);
    if (job) setJobStatus(jobId, "error", msg);
  });
}
