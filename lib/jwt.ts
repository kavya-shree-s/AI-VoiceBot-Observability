export type BreezeJwtClaims = {
  reseller_ids?: string[];
  merchant_ids?: string[];
  sub?: string;
  exp?: number;
};

export function decodeJwt(token: string): BreezeJwtClaims | null {
  const clean = token.trim().replace(/^(authorization:\s*)?bearer\s+/i, "");
  const parts = clean.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(json) as BreezeJwtClaims;
  } catch {
    return null;
  }
}

export function resolveOrgIds(token: string): {
  resellerId: string;
  merchantId: string;
} | null {
  const claims = decodeJwt(token);
  if (!claims) return null;
  const resellerId = claims.reseller_ids?.[0];
  const merchantId = claims.merchant_ids?.[0];
  if (!resellerId || !merchantId) return null;
  return { resellerId, merchantId };
}
