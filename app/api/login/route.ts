import { NextRequest, NextResponse } from "next/server";
import { parseLoginResponse } from "@/lib/login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_URL =
  process.env.BREEZE_LOGIN_URL ??
  "https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/login";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  const data = await upstream.json().catch(() => null);
  const result = parseLoginResponse(upstream.status, data);
  if (!result.ok) {
    // A 2xx that failed to parse is an upstream contract break, not a client error.
    const status = upstream.ok ? 502 : upstream.status;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ token: result.token });
}
