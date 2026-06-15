import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { mineInsights } from "@/lib/insights/orchestrator";
import { makeClaudeJson } from "@/lib/insights/claude";
import type { CallRef } from "@/lib/breeze/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: string;
  calls?: CallRef[];
  sampleSize?: number;
  chunkSize?: number;
  stratifyBy?: "outcome" | "template";
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  if (!Array.isArray(body.calls) || body.calls.length === 0) {
    return NextResponse.json({ error: "calls must be a non-empty array" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const claude = makeClaudeJson(new Anthropic());
  try {
    const insights = await mineInsights(
      {
        calls: body.calls,
        token: body.token,
        sampleSize: body.sampleSize ?? 20,
        chunkSize: body.chunkSize ?? 10,
        stratifyBy: body.stratifyBy ?? "outcome",
      },
      claude
    );
    return NextResponse.json({ insights });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
