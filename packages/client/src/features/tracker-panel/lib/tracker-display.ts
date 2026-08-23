export function visibleText(value: string | number | null | undefined, fallback = "Unknown") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

export function trackerEditableText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const statValue = typeof record.value === "number" || typeof record.value === "string" ? record.value : null;
    const statMax = typeof record.max === "number" || typeof record.max === "string" ? record.max : null;
    if (name && statValue !== null)
      return statMax !== null ? `${name}: ${statValue}/${statMax}` : `${name}: ${statValue}`;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getNumberValueWidth(value: number | string) {
  const text = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "0") : value.trim() || "0";
  return `${Math.min(10, Math.max(1.35, text.length + 0.35))}ch`;
}
