import { describe, it, expect } from "vitest";
import { parseLoginResponse } from "./login";

describe("parseLoginResponse", () => {
  it("extracts the access_token on a 200 response", () => {
    const result = parseLoginResponse(200, {
      access_token: "eyJ.jwt.token",
      token_type: "Bearer",
      expires_in: 3600,
    });
    expect(result).toEqual({ ok: true, token: "eyJ.jwt.token" });
  });

  it("fails when a 200 response is missing access_token", () => {
    const result = parseLoginResponse(200, { token_type: "Bearer" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/token/i);
  });

  it("surfaces the upstream detail message on a 401", () => {
    const result = parseLoginResponse(401, { detail: "Invalid credentials" });
    expect(result).toEqual({ ok: false, error: "Invalid credentials" });
  });

  it("falls back to a status-based message when the error body is unhelpful", () => {
    const result = parseLoginResponse(500, "<html>oops</html>");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/500/);
  });
});
