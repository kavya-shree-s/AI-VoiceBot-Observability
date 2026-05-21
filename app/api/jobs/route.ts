import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createJob } from "@/lib/jobStore";
import { safeRun, type ExtractItem } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateJobBody = {
  token: string;
  items: ExtractItem[];
};

export async function POST(req: NextRequest) {
  let body: CreateJobBody;
  try {
    body = (await req.json()) as CreateJobBody;
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

  const id = nanoid(10);
  createJob(id, body.items.length);
  safeRun(id, body.token, body.items);
  return NextResponse.json({ id, total: body.items.length });
}
