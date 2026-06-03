export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

function messageFrom(body: unknown): string | null {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["detail", "error", "message"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return null;
}

export function parseLoginResponse(status: number, body: unknown): LoginResult {
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      error: messageFrom(body) ?? `Login failed (HTTP ${status})`,
    };
  }
  const token =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).access_token
      : undefined;
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, error: "Login response did not include a token" };
  }
  return { ok: true, token };
}
