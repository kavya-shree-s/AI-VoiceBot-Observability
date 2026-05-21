const BASE_URL =
  process.env.BREEZE_RECORDING_URL ??
  "https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/leads/recording";

export type FetchResult =
  | { ok: true; data: Buffer }
  | { ok: false; httpStatus?: number; message: string };

function normalizeToken(token: string): string {
  const trimmed = token.trim();
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwt) return jwt[0];
  return trimmed.replace(/^(authorization:\s*)?bearer\s+/i, "").trim();
}

export async function fetchRecording(
  callId: string,
  token: string,
  attempts = 3
): Promise<FetchResult> {
  const url = `${BASE_URL}/${encodeURIComponent(callId)}`;
  const clean = normalizeToken(token);
  let lastErr: FetchResult = { ok: false, message: "unknown error" };

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
        const ab = await res.arrayBuffer();
        return { ok: true, data: Buffer.from(ab) };
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
