import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    failed: job.failed,
    errorMessage: job.errorMessage,
  });
}
