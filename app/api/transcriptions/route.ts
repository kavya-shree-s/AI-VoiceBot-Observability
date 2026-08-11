import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import { fetchLead } from "@/lib/leadFetcher";
import {
  extractTranscription,
  extractTemplateId,
  extractCallEndedBy,
  extractRecordingUrl,
  filterByKeyword,
  toCsv,
  type TranscriptRow,
} from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONCURRENCY = 5;

type Item = {
  leadId?: string;
  callId: string;
  phone?: string;
  name?: string;
  template?: string;
  outcome?: string;
  startTime?: string;
};

type Body = { token?: string; items?: Item[]; keyword?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.token || typeof body.token !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid token" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "items must be a non-empty array" },
      { status: 400 }
    );
  }

  const token = body.token;
  const limit = pLimit(CONCURRENCY);
  let authFailed = false;

  const rows: TranscriptRow[] = await Promise.all(
    body.items.map((item) =>
      limit(async (): Promise<TranscriptRow> => {
        const base = {
          leadId: item.leadId ?? "",
          phone: item.phone ?? "",
          name: item.name ?? "",
          callId: item.callId,
          template: item.template ?? "",
          templateId: "",
          outcome: item.outcome ?? "",
          callEndedBy: "",
          startTime: item.startTime ?? "",
          recordingUrl: "",
        };
        // The lead-detail endpoint is keyed by the lead's internal id
        // ("Lead ID" in the CSV), not the telephony Call ID used for recordings.
        const fetchId = item.leadId || item.callId;
        const result = await fetchLead(fetchId, token);
        if (!result.ok) {
          if (result.httpStatus === 401 || result.httpStatus === 403) {
            authFailed = true;
          }
          return { ...base, transcription: `[error: ${result.message}]` };
        }
        return {
          ...base,
          templateId: extractTemplateId(result.data),
          callEndedBy: extractCallEndedBy(result.data),
          recordingUrl: extractRecordingUrl(result.data),
          transcription: extractTranscription(result.data),
        };
      })
    )
  );

  // A 401/403 means the token is bad for every lead — surface it so the
  // client can prompt a re-login instead of downloading a CSV full of errors.
  if (authFailed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matched = filterByKeyword(rows, body.keyword ?? "");
  const csv = toCsv(matched);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Match-Count": String(matched.length),
      "X-Total-Count": String(rows.length),
    },
  });
}
