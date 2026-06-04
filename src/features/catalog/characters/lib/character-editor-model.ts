import { characterDataSchema, characterExtensionsSchema } from "../../../../engine/contracts/schemas/character.schema";
import type { CharacterCardVersion, CharacterData, RPGStatsConfig } from "../../../../engine/contracts/types/character";
import { formatTextQuotes, type QuoteFormat } from "../../../../shared/lib/dialogue-quotes";

export interface AltDescriptionEntry {
  id: string;
  label: string;
  content: string;
  active: boolean;
}

export const VERSION_COMPARE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "personality", label: "Personality" },
  { key: "scenario", label: "Scenario" },
  { key: "first_mes", label: "First Message" },
  { key: "mes_example", label: "Example Dialogue" },
  { key: "extensions.backstory", label: "Backstory" },
  { key: "extensions.appearance", label: "Appearance" },
  { key: "creator_notes", label: "Creator Notes" },
  { key: "system_prompt", label: "System Prompt" },
  { key: "post_history_instructions", label: "Post-History Instructions" },
];

export const DEFAULT_RPG_STATS: RPGStatsConfig = {
  enabled: false,
  attributes: [
    { name: "STR", value: 10 },
    { name: "DEX", value: 10 },
    { name: "CON", value: 10 },
    { name: "INT", value: 10 },
    { name: "WIS", value: 10 },
    { name: "CHA", value: 10 },
  ],
  hp: { value: 100, max: 100 },
};

const QUOTE_FORMATTED_CHARACTER_FIELDS = new Set<keyof CharacterData>([
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
  "alternate_greetings",
]);

const QUOTE_FORMATTED_EXTENSION_FIELDS = new Set(["backstory", "appearance", "altDescriptions", "depth_prompt"]);
const CREATOR_NOTES_STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

function formatAltDescriptions(value: unknown, quoteFormat: QuoteFormat): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const record = entry as Record<string, unknown>;
    return {
      ...record,
      content: typeof record.content === "string" ? formatTextQuotes(record.content, quoteFormat) : record.content,
    };
  });
}

function formatDepthPrompt(value: unknown, quoteFormat: QuoteFormat): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return {
    ...record,
    prompt: typeof record.prompt === "string" ? formatTextQuotes(record.prompt, quoteFormat) : record.prompt,
  };
}

function formatCreatorNotes(value: string, quoteFormat: QuoteFormat): string {
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CREATOR_NOTES_STYLE_BLOCK_RE.lastIndex = 0;

  while ((match = CREATOR_NOTES_STYLE_BLOCK_RE.exec(value)) !== null) {
    result += formatTextQuotes(value.slice(lastIndex, match.index), quoteFormat);
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  result += formatTextQuotes(value.slice(lastIndex), quoteFormat);
  return result;
}

export function formatCharacterEditorField<K extends keyof CharacterData>(
  key: K,
  value: CharacterData[K],
  quoteFormat: QuoteFormat,
): CharacterData[K] {
  if (!QUOTE_FORMATTED_CHARACTER_FIELDS.has(key)) return value;
  if (key === "creator_notes" && typeof value === "string") {
    return formatCreatorNotes(value, quoteFormat) as CharacterData[K];
  }
  if (typeof value === "string") return formatTextQuotes(value, quoteFormat) as CharacterData[K];
  if (key === "alternate_greetings" && Array.isArray(value)) {
    return value.map((greeting) =>
      typeof greeting === "string" ? formatTextQuotes(greeting, quoteFormat) : greeting,
    ) as CharacterData[K];
  }
  return value;
}

export function formatCharacterEditorExtension(key: string, value: unknown, quoteFormat: QuoteFormat): unknown {
  if (!QUOTE_FORMATTED_EXTENSION_FIELDS.has(key)) return value;
  if (typeof value === "string") return formatTextQuotes(value, quoteFormat);
  if (key === "altDescriptions") return formatAltDescriptions(value, quoteFormat);
  if (key === "depth_prompt") return formatDepthPrompt(value, quoteFormat);
  return value;
}

export function normalizeAltDescriptions(value: unknown): AltDescriptionEntry[] {
  const raw = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry, index) => ({
      id: typeof entry.id === "string" && entry.id.trim() ? entry.id : `extension-${index}`,
      label: typeof entry.label === "string" ? entry.label : "Extension",
      content: typeof entry.content === "string" ? entry.content : "",
      active: entry.active !== false,
    }));
}

export function normalizeCharacterEditorData(data: CharacterData | null | undefined): CharacterData | null {
  if (!data) return null;

  const parsed = characterDataSchema.safeParse(data);
  if (parsed.success) {
    return parsed.data as CharacterData;
  }

  // Keep recoverable cards editable while still applying nested extension defaults.
  const ext = characterExtensionsSchema.safeParse(data.extensions ?? {});
  return {
    ...data,
    extensions: (ext.success ? ext.data : {}) as CharacterData["extensions"],
  };
}

export function getVersionFieldValue(data: CharacterData, key: string): string {
  if (key === "extensions.backstory" || key === "extensions.appearance") {
    const extensionKey = key.split(".")[1] ?? "";
    const value = data.extensions?.[extensionKey];
    return typeof value === "string" ? value : "";
  }
  const value = data[key as keyof CharacterData];
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
}

export function formatVersionTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getVersionTitle(version: CharacterCardVersion): string {
  return version.version?.trim() ? `v${version.version}` : "Untitled version";
}
