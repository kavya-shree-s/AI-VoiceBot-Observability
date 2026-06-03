import { NextRequest, NextResponse } from "next/server";
import { fetchRecording } from "@/lib/fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVALUATOR_URL = process.env.EVALUATOR_URL ?? "http://localhost:8000";

type EvaluateBody = {
  token?: string;
  callId?: string;
  parameters?: string[];
  input_prompt?: string;
  thresholds?: Record<string, unknown>;
  extraction_schema?: Record<string, string>;
  bot_captured_variables?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  let body: EvaluateBody;
  try {
    body = (await req.json()) as EvaluateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.token || !body.callId) {
    return NextResponse.json(
      { error: "token and callId are required" },
      { status: 400 }
    );
  }
  if (!body.parameters || body.parameters.length === 0) {
    return NextResponse.json(
      { error: "At least one evaluation parameter is required." },
      { status: 400 }
    );
  }

  // 1) Pull the recording (keeps the breeze token on the Node side).
  const recording = await fetchRecording(body.callId, body.token, 2);
  if (!recording.ok) {
    return NextResponse.json(
      { error: `Could not fetch recording: ${recording.message}` },
      { status: recording.httpStatus ?? 502 }
    );
  }

  // 2) Forward audio + params to the Python evaluator sidecar.
  const payload = {
    parameters: body.parameters,
    input_prompt: body.input_prompt,
    thresholds: body.thresholds,
    extraction_schema: body.extraction_schema,
    bot_captured_variables: body.bot_captured_variables,
  };

  const form = new FormData();
  const ab = new ArrayBuffer(recording.data.byteLength);
  new Uint8Array(ab).set(recording.data);
  form.append("audio_file", new Blob([ab], { type: "audio/mpeg" }), `${body.callId}.mp3`);
  form.append("payload", JSON.stringify(payload));

  try {
    const upstream = await fetch(`${EVALUATOR_URL}/evaluate`, {
      method: "POST",
      body: form,
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.detail ?? `Evaluator error (${upstream.status})` },
        { status: upstream.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? `Evaluator unreachable at ${EVALUATOR_URL}: ${e.message}`
            : String(e),
      },
      { status: 503 }
    );
  }
}
