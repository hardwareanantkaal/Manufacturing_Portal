import crypto from "crypto";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  userId: string; // ClientUser.id
  clientId: string; // Client.id — every tenant-scoped query filters on this
  role: string; // "admin" | "viewer"
  exp: number; // unix seconds
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set in .env");
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

// cookie shape: "<base64url json payload>.<base64url hmac signature>"
// the signature proves the payload was produced by this server, so a
// visitor cannot hand-edit the cookie to claim to be a different user
// or a different client organization.
export function encodeSession(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${json}.${sign(json)}`;
}

export function verifySessionCookie(raw: string): SessionPayload | null {
  const [json, signature] = raw.split(".");
  if (!json || !signature) return null;

  const expected = Buffer.from(sign(json));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null; // signature missing, tampered, or signed with an old secret
  }

  const payload = JSON.parse(Buffer.from(json, "base64url").toString()) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired

  return payload;
}
