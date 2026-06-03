export type TranscriptRow = {
  phone: string;
  name: string;
  callId: string;
  template: string;
  templateId: string;
  outcome: string;
  callEndedBy: string;
  startTime: string;
  recordingUrl: string;
  transcription: string;
};

const SKIP_ROLES = new Set(["system", "tool"]);

type Turn = { role?: unknown; content?: unknown };

/**
 * Pulls the spoken conversation out of a `/leads/<callId>` response.
 * The raw `metaData.transcription` array also carries the bot's system
 * prompts and tool-call results; those are dropped so the export holds
 * only the assistant/user exchange.
 */
export function extractTranscription(lead: unknown): string {
  const turns = (lead as { metaData?: { transcription?: unknown } })?.metaData
    ?.transcription;
  if (!Array.isArray(turns)) return "";
  return (turns as Turn[])
    .filter(
      (t) =>
        t &&
        typeof t.content === "string" &&
        typeof t.role === "string" &&
        !SKIP_ROLES.has(t.role)
    )
    .map((t) => `${t.role as string}: ${t.content as string}`)
    .join("\n");
}

/** Reads the template id from a `/leads/<id>` response. */
export function extractTemplateId(lead: unknown): string {
  const id = (lead as { template_id?: unknown })?.template_id;
  return typeof id === "string" ? id : "";
}

/** Reads who ended the call from `metaData.call_ended_by`. */
export function extractCallEndedBy(lead: unknown): string {
  const value = (lead as { metaData?: { call_ended_by?: unknown } })?.metaData
    ?.call_ended_by;
  return typeof value === "string" ? value : "";
}

/** Reads the top-level `recording_url`. */
export function extractRecordingUrl(lead: unknown): string {
  const url = (lead as { recording_url?: unknown })?.recording_url;
  return typeof url === "string" ? url : "";
}

/**
 * Keeps only the rows whose transcription contains the keyword
 * (case-insensitive substring). An empty/whitespace keyword keeps everything.
 */
export function filterByKeyword(
  rows: TranscriptRow[],
  keyword: string
): TranscriptRow[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.transcription.toLowerCase().includes(q));
}

const COLUMNS: Array<[keyof TranscriptRow, string]> = [
  ["phone", "phone"],
  ["name", "name"],
  ["callId", "call_id"],
  ["template", "template"],
  ["templateId", "template_id"],
  ["outcome", "outcome"],
  ["callEndedBy", "call_ended_by"],
  ["startTime", "start_time"],
  ["recordingUrl", "recording_url"],
  ["transcription", "transcription"],
];

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: TranscriptRow[]): string {
  const header = COLUMNS.map(([, label]) => label).join(",");
  const body = rows.map((row) =>
    COLUMNS.map(([key]) => escapeField(row[key] ?? "")).join(",")
  );
  return [header, ...body].join("\n");
}
