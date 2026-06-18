import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchLeadDetailsBatch } from "@/lib/breeze/client";
import { runCensus } from "@/lib/insights/census";
import { makeHaikuClassifier } from "@/lib/insights/haikuClassifier";
import { reasonBreakdown, summary } from "@/lib/insights/aggregate";
import { buildWorkbook } from "@/lib/insights/workbook";
import type { CallInput } from "@/lib/insights/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: string;
  calls?: CallInput[];
  reportDate?: string;
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

  const classify = makeHaikuClassifier(new Anthropic());
  const reportDate = body.reportDate ?? new Date().toISOString().slice(0, 10);
  const template = body.calls[0].template || "driver-rides-block-support";

  try {
    const labels = await runCensus(body.calls, body.token, {
      fetchBatch: fetchLeadDetailsBatch,
      classify,
    });

    if (new URL(req.url).searchParams.get("format") === "xlsx") {
      const buf = await buildWorkbook(labels, { reportDate, template });
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="call_analysis_${reportDate}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      summary: summary(labels, { reportDate, template }),
      breakdown: reasonBreakdown(labels),
      perCall: labels,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
