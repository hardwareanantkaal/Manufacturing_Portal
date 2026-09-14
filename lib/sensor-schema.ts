export type SensorField = { key: string; label: string; unit: string };

export function getSensorValue(payload: unknown, field: { key: string; label?: string }) {
  if (!payload || typeof payload !== "object") return undefined;
  const obj = payload as Record<string, unknown>;

  // 1. Direct key match
  if (field.key in obj) return obj[field.key];

  // 2. Case-insensitive key match
  const lowerKey = field.key.toLowerCase();
  const foundByKey = Object.keys(obj).find((k) => k.toLowerCase() === lowerKey);
  if (foundByKey !== undefined) return obj[foundByKey];

  // 3. Match by label if present (e.g. label="Humidity", payload has "humidity")
  if (field.label) {
    const lowerLabel = field.label.toLowerCase();
    const foundByLabel = Object.keys(obj).find((k) => k.toLowerCase() === lowerLabel);
    if (foundByLabel !== undefined) return obj[foundByLabel];
  }

  // 4. Prefix/fuzzy match (e.g. key="Temp", payload has "temperature" or "temp")
  const foundByPrefix = Object.keys(obj).find(
    (k) => k.toLowerCase().startsWith(lowerKey) || lowerKey.startsWith(k.toLowerCase())
  );
  if (foundByPrefix !== undefined) return obj[foundByPrefix];

  return undefined;
}
