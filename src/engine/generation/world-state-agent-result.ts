import { isRecord, parseRecord } from "./runtime-records";

const WORLD_STATE_FIELDS = ["date", "time", "location", "weather", "temperature"] as const;
const TEXT_FALLBACK_KEYS = ["text", "summary", "value", "content", "result"] as const;

type WorldStateAgentField = (typeof WORLD_STATE_FIELDS)[number];
export type WorldStateAgentPatch = Partial<Record<WorldStateAgentField, string | null>>;

function readNullableWorldStateString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text.length ? text : null;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

function structuredWorldStatePatch(data: unknown): WorldStateAgentPatch | null {
  const record = parseRecord(data);
  if (!Object.keys(record).length) return null;

  const patch: WorldStateAgentPatch = {};
  for (const field of WORLD_STATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      patch[field] = readNullableWorldStateString(record[field]);
    }
  }
  return Object.keys(patch).length ? patch : null;
}

function nestedStructuredWorldStatePatch(data: unknown): WorldStateAgentPatch | null {
  const record = parseRecord(data);
  for (const key of ["worldState", "world_state", "state"] as const) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const patch = structuredWorldStatePatch(record[key]);
    if (patch) return patch;
  }
  return null;
}

function textFallback(data: unknown): string | null {
  if (typeof data === "string") {
    const text = data.trim();
    return text.length ? text : null;
  }
  if (!isRecord(data)) return null;
  for (const key of TEXT_FALLBACK_KEYS) {
    const text = readNullableWorldStateString(data[key]);
    if (text) return text;
  }
  return null;
}

function removeFences(text: string): string {
  return text.replace(/```(?:[a-z0-9_-]+)?/gi, "").trim();
}

function structuredWorldStatePatchFromText(text: string): WorldStateAgentPatch | null {
  const jsonMatch = removeFences(text).match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return null;
  try {
    return structuredWorldStatePatch(JSON.parse(jsonMatch[1]!));
  } catch {
    return null;
  }
}

function normalizeFreeformWorldStateText(text: string): string {
  return removeFences(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (/^(?:world[-_\s]*state|game[-_\s]*state(?:[-_\s]*update)?)$/i.test(line)) return [];
      const stripped = line
        .replace(/^(?:world[-_\s]*state|game[-_\s]*state(?:[-_\s]*update)?)\b\s*(?::|=|-|–|—)?\s*/i, "")
        .trim();
      return stripped ? [stripped] : [];
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeDate(text: string): boolean {
  return /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|day\s+\d+|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4})\b/i.test(
    text,
  );
}

function looksLikeTime(text: string): boolean {
  return /\b(?:dawn|daybreak|sunrise|morning|noon|afternoon|sunset|dusk|evening|night|midnight|twilight|hour|late|early|\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm))\b/i.test(
    text,
  );
}

function looksLikeWeather(text: string): boolean {
  return /\b(?:clear|cloudy|clouds|overcast|rain|rainy|drizzle|storm|stormy|thunder|lightning|snow|snowy|blizzard|fog|foggy|mist|misty|wind|windy|gale|hail|sleet|humid|dry)\b/i.test(
    text,
  );
}

function looksLikeTemperature(text: string): boolean {
  return /\b(?:-?\d+(?:\.\d+)?\s*(?:°|degrees?\s*)?(?:c|f|celsius|fahrenheit)|freezing|cold|cool|chilly|frigid|icy|mild|temperate|warm|hot|scorching|sweltering)\b/i.test(
    text,
  );
}

function freeformWorldStatePatch(text: string): WorldStateAgentPatch | null {
  const normalized = normalizeFreeformWorldStateText(text);
  if (!normalized) return null;

  const parts = normalized
    .split(/\s+(?:-|–|—)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const patch: WorldStateAgentPatch = {};
  const locationParts: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const firstLooksLikeLocation =
      index === 0 && parts.length >= 3 && !looksLikeDate(part) && !looksLikeTemperature(part);
    if (firstLooksLikeLocation) {
      locationParts.push(part);
      continue;
    }

    if (!patch.temperature && looksLikeTemperature(part)) {
      patch.temperature = part;
    } else if (!patch.weather && looksLikeWeather(part)) {
      patch.weather = part;
    } else if (!patch.time && looksLikeTime(part)) {
      patch.time = part;
    } else if (!patch.date && looksLikeDate(part)) {
      patch.date = part;
    } else {
      locationParts.push(part);
    }
  }

  if (locationParts.length > 0 && !patch.location) {
    patch.location = locationParts.join(" - ");
  }

  return Object.keys(patch).length ? patch : null;
}

export function worldStatePatchFromAgentData(
  data: unknown,
  options: { allowFreeform?: boolean } = {},
): WorldStateAgentPatch | null {
  const structured = structuredWorldStatePatch(data) ?? nestedStructuredWorldStatePatch(data);
  if (structured) return structured;
  if (options.allowFreeform === false) return null;

  const text = textFallback(data);
  if (!text) return null;
  return structuredWorldStatePatchFromText(text) ?? freeformWorldStatePatch(text);
}
