import { NextRequest, NextResponse } from "next/server";
import { deleteJob, getJob } from "@/lib/jobStore";

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
  if (job.status !== "done" || !job.zip) {
    return NextResponse.json(
      { error: `Job is not ready (status=${job.status})` },
      { status: 409 }
    );
  }

  const zip = job.zip;
  const filename = `recordings-${new Date()
    .toISOString()
    .slice(0, 10)}-${id}.zip`;

  const ab = new ArrayBuffer(zip.byteLength);
  new Uint8Array(ab).set(zip);
  const response = new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.byteLength),
      "Cache-Control": "no-store",
    },
  });

  deleteJob(id);
  return response;
}
