import crypto from "crypto";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateApiKey(): string {
  return crypto.randomBytes(16).toString("hex"); // 32 hex characters
}
