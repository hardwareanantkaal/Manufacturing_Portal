// Uses the Web Crypto API (globalThis.crypto.subtle), not Node's "crypto"
// module — this file is imported by proxy.ts, which runs on Vercel's Edge
// runtime by default and doesn't have Node's crypto module available.
// Web Crypto works in both Edge and Node (Node has had it as a global
// since v19), so this one implementation is correct everywhere the app runs.

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  adminId: string;
  email: string;
  name: string | null;
  exp: number; // unix seconds
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set in .env");
  return secret;
}

let cachedKey: { secret: string; key: CryptoKey } | null = null;

// Re-importing the HMAC key on every request (proxy.ts runs on every
// navigation) is wasted work — cache it, and only re-import if the secret
// itself ever changes (it won't, in a running process, but this is cheap
// insurance against stale state rather than assuming that).
async function getKey(): Promise<CryptoKey> {
  const secret = getSecret();
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  cachedKey = { secret, key };
  return key;
}

function bufToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns a plain ArrayBuffer (not a Uint8Array) — Uint8Array's .buffer is
// typed ArrayBufferLike, which the Web Crypto DOM types don't accept
// directly. Allocating the ArrayBuffer explicitly sidesteps that.
function base64UrlToBuf(b64url: string): ArrayBuffer {
  const padded = b64url + "=".repeat((4 - (b64url.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buf;
}

// cookie shape: "<base64url json payload>.<base64url hmac signature>"
// the signature proves the payload was produced by this server, so a
// visitor cannot hand-edit the cookie to claim to be a different admin.
export async function encodeSession(payload: SessionPayload): Promise<string> {
  const json = bufToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(json));
  return `${json}.${bufToBase64Url(signature)}`;
}

export async function verifySessionCookie(raw: string): Promise<SessionPayload | null> {
  const [json, signature] = raw.split(".");
  if (!json || !signature) return null;

  const key = await getKey();
  // crypto.subtle.verify() does its own constant-time comparison
  // internally — no separate timing-safe-equal step needed here.
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBuf(signature),
    new TextEncoder().encode(json)
  );
  if (!valid) return null; // signature missing, tampered, or signed with an old secret

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBuf(json))) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired

  return payload;
}
