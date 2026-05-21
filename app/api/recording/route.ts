import { NextRequest, NextResponse } from "next/server";
import { fetchRecording } from "@/lib/fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { token?: string; callId?: string };
  try {
    body = (await req.json()) as { token?: string; callId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.token || !body.callId) {
    return NextResponse.json(
      { error: "token and callId are required" },
      { status: 400 }
    );
  }

  const result = await fetchRecording(body.callId, body.token, 2);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.httpStatus ?? 502 }
    );
  }
  const ab = new ArrayBuffer(result.data.byteLength);
  new Uint8Array(ab).set(result.data);
  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(result.data.byteLength),
      "Cache-Control": "private, max-age=300",
    },
  });
}
