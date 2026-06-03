const BASE_URL =
  process.env.BREEZE_LEADS_URL ??
  "https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/leads";

export type LeadResult =
  | { ok: true; data: unknown }
  | { ok: false; httpStatus?: number; message: string };

function normalizeToken(token: string): string {
  const trimmed = token.trim();
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwt) return jwt[0];
  return trimmed.replace(/^(authorization:\s*)?bearer\s+/i, "").trim();
}

/** Fetches a single lead (including its transcription) by Call ID. */
export async function fetchLead(
  callId: string,
  token: string,
  attempts = 2
): Promise<LeadResult> {
  const url = `${BASE_URL}/${encodeURIComponent(callId)}`;
  const clean = normalizeToken(token);
  let lastErr: LeadResult = { ok: false, message: "unknown error" };

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${clean}`,
        },
      });
      if (!res.ok) {
        lastErr = {
          ok: false,
          httpStatus: res.status,
          message: `HTTP ${res.status} ${res.statusText}`,
        };
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          return lastErr;
        }
      } else {
        const data = (await res.json()) as unknown;
        return { ok: true, data };
      }
    } catch (e) {
      lastErr = {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      };
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return lastErr;
}
