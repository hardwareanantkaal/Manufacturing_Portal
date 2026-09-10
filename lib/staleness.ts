export type Staleness = "ok" | "warn" | "critical";

export function getStaleness(lastReadingAt: Date | null, readIntervalSeconds: number): Staleness {
  if (!lastReadingAt) return "critical";
  const ageSeconds = (Date.now() - lastReadingAt.getTime()) / 1000;
  if (ageSeconds > readIntervalSeconds * 6) return "critical";
  if (ageSeconds > readIntervalSeconds * 2) return "warn";
  return "ok";
}

export function formatRelativeTime(date: Date | null): string {
  if (!date) return "never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const STALENESS_CLASSES: Record<Staleness, string> = {
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  warn: "text-amber-700 bg-amber-50 border-amber-200",
  critical: "text-rose-700 bg-rose-50 border-rose-200",
};
