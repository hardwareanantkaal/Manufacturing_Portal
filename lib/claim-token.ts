import crypto from "crypto";

export function generateClaimToken(): string {
  return crypto.randomBytes(16).toString("hex"); // 32 hex characters
}
