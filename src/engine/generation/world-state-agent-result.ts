import { isRecord, parseRecord } from "./runtime-records";

const WORLD_STATE_FIELDS = ["date", "time", "location", "weather", "temperature"] as const;
const STABLE_EXPLICIT_FIELDS = ["date", "time", "temperature"] as const;
const TEXT_FALLBACK_KEYS = ["text", "summary", "value", "content", "result"] as const;

type WorldStateAgentField = (typeof WORLD_STATE_FIELDS)[number];
export type WorldStateAgentPatch = Partial<Record<WorldStateAgentField, string | null>>;
type StableExplicitField = (typeof STABLE_EXPLICIT_FIELDS)[number];

export interface WorldStateAgentPatchOptions {
  allowFreeform?: boolean;
  sourceText?: string | null;
  previousWorldState?: Partial<Record<StableExplicitField, unknown>> | null;
}

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
  return /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|next\s+day|following\s+day|day\s+\d+|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4})\b/i.test(
    text,
  );
}

function looksLikeTime(text: string): boolean {
  return /\b(?:dawn|daybreak|sunrise|morning|noon|afternoon|sunset|dusk|evening|night|midnight|twilight|hours?\s+later|later\s+that\s+(?:morning|afternoon|evening|night)|hour|late|early|\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))\b/i.test(
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

function readPreviousStableField(
  previousWorldState: WorldStateAgentPatchOptions["previousWorldState"],
  field: StableExplicitField,
): string | null {
  if (!previousWorldState) return null;
  return readNullableWorldStateString(previousWorldState[field]);
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function titleCaseWord(text: string): string {
  const lower = text.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function normalizeTimeSuffix(text: string): string {
  return normalizeSpaces(text).replace(/\s*(a\.m\.|p\.m\.|am|pm)\b/i, (match) =>
    ` ${match.replace(/\./g, "").toUpperCase().trim()}`,
  );
}

function normalizeTemperature(text: string): string {
  return normalizeSpaces(text)
    .replace(/\s+/g, "")
    .replace(/\u00b0?([CF])$/i, (_match, unit: string) => `\u00b0${unit.toUpperCase()}`)
    .replace(/celsius$/i, "\u00b0C")
    .replace(/fahrenheit$/i, "\u00b0F");
}

function exactDateFromText(text: string): string | null {
  const weekday = text.match(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0];
  if (weekday) return titleCaseWord(weekday);

  const monthDate = text.match(
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{2,4})?\b/i,
  )?.[0];
  if (monthDate) return normalizeSpaces(monthDate);

  const numericDate = text.match(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/)?.[0];
  if (numericDate) return numericDate;

  const storyDay = text.match(/\bday\s+\d+\b/i)?.[0];
  return storyDay ? normalizeSpaces(storyDay) : null;
}

function exactTimeFromText(text: string): string | null {
  const clock = text.match(/\b\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?\b/i)?.[0];
  if (clock) return normalizeTimeSuffix(clock);

  const hour = text.match(/\b\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)\b/i)?.[0];
  if (hour) return normalizeTimeSuffix(hour);

  const named = text.match(/\b(?:noon|midnight|dawn|daybreak|sunrise|morning|afternoon|sunset|dusk|evening|night|twilight)\b/i)?.[0];
  return named ? normalizeSpaces(named) : null;
}

function exactTemperatureFromText(text: string): string | null {
  const unitTemperature = text.match(/\b-?\d+(?:\.\d+)?\s*(?:\u00b0\s*)?(?:c|f|celsius|fahrenheit)\b/i)?.[0];
  if (unitTemperature) return normalizeTemperature(unitTemperature);

  const degreeTemperature = text.match(
    /\b(?:temperature|thermometer|air|room|outside|inside|weather)\b[^.?!;\n]{0,60}\b-?\d+(?:\.\d+)?\s*degrees?\b/i,
  )?.[0];
  if (!degreeTemperature) return null;
  const value = degreeTemperature.match(/\b-?\d+(?:\.\d+)?\s*degrees?\b/i)?.[0];
  return value ? normalizeSpaces(value) : null;
}

function explicitWorldStateFactsFromText(text: string | null | undefined): WorldStateAgentPatch {
  const sourceText = (text ?? "").trim();
  if (!sourceText) return {};
  const patch: WorldStateAgentPatch = {};
  const date = exactDateFromText(sourceText);
  const time = exactTimeFromText(sourceText);
  const temperature = exactTemperatureFromText(sourceText);
  if (date) patch.date = date;
  if (time) patch.time = time;
  if (temperature) patch.temperature = temperature;
  return patch;
}

function sourceMentionsStableField(text: string | null | undefined, field: StableExplicitField): boolean {
  const sourceText = (text ?? "").trim();
  if (!sourceText) return false;
  if (field === "date") return looksLikeDate(sourceText);
  if (field === "time") return looksLikeTime(sourceText);
  return looksLikeTemperature(sourceText);
}

function stabilizeExplicitFields(
  patch: WorldStateAgentPatch | null,
  options: WorldStateAgentPatchOptions,
): WorldStateAgentPatch | null {
  const explicitFacts = explicitWorldStateFactsFromText(options.sourceText);
  if (!patch && Object.keys(explicitFacts).length === 0) return null;

  const nextPatch: WorldStateAgentPatch = { ...(patch ?? {}) };
  for (const field of STABLE_EXPLICIT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(explicitFacts, field)) {
      nextPatch[field] = explicitFacts[field] ?? null;
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(nextPatch, field)) continue;
    if (sourceMentionsStableField(options.sourceText, field)) continue;
    const previous = readPreviousStableField(options.previousWorldState, field);
    if (previous) nextPatch[field] = previous;
  }

  return Object.keys(nextPatch).length ? nextPatch : null;
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
  options: WorldStateAgentPatchOptions = {},
): WorldStateAgentPatch | null {
  const structured = structuredWorldStatePatch(data) ?? nestedStructuredWorldStatePatch(data);
  if (structured) return stabilizeExplicitFields(structured, options);
  if (options.allowFreeform === false) return stabilizeExplicitFields(null, options);

  const text = textFallback(data);
  if (!text) return stabilizeExplicitFields(null, options);
  return stabilizeExplicitFields(structuredWorldStatePatchFromText(text) ?? freeformWorldStatePatch(text), options);
}
