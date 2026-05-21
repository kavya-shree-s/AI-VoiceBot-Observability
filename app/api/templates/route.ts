import { NextRequest, NextResponse } from "next/server";
import { resolveOrgIds } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES_BASE =
  process.env.BREEZE_TEMPLATES_URL ??
  "https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/templates/list";

type Template = {
  id: string;
  name: string;
  is_active: boolean;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwt) return jwt[0];
  return trimmed.replace(/^(authorization:\s*)?bearer\s+/i, "").trim();
}

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const rawToken = body.token;
  if (!rawToken) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const token = normalizeToken(rawToken);
  const org = resolveOrgIds(token);
  if (!org) {
    return NextResponse.json(
      { error: "Could not read reseller/merchant from token" },
      { status: 400 }
    );
  }
  const url = new URL(TEMPLATES_BASE);
  url.searchParams.set("reseller_id", org.resellerId);
  url.searchParams.set("merchant_id", org.merchantId);
  url.searchParams.set("include_inactive", "true");

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `Upstream ${upstream.status}: ${text || upstream.statusText}` },
        { status: upstream.status }
      );
    }
    const data = (await upstream.json()) as { templates?: Template[] };
    const templates = (data.templates ?? [])
      .map((t) => ({ id: t.id, name: t.name, is_active: t.is_active }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
