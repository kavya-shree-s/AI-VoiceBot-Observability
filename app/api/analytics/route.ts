import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYTICS_URL =
  process.env.BREEZE_ANALYTICS_URL ??
  "https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/analytics";

type Body = {
  token?: string;
  type?: string;
  filters?: Record<string, unknown>;
  options?: Record<string, unknown>;
};

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
  if (!body.type) {
    return NextResponse.json(
      { error: "Missing analytics `type`" },
      { status: 400 }
    );
  }

  const upstreamBody = {
    type: body.type,
    filters: body.filters ?? {},
    options: body.options ?? {},
  };

  try {
    const upstream = await fetch(ANALYTICS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${body.token}`,
      },
      body: JSON.stringify(upstreamBody),
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            (data && typeof data === "object" && "detail" in data
              ? String((data as { detail: unknown }).detail)
              : undefined) ?? `Upstream ${upstream.status}`,
        },
        { status: upstream.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
