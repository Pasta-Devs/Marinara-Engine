import { api } from "./api-client";
import type { CharacterData } from "@marinara-engine/shared";

export interface EmbeddedLorebookImportPreview {
  filename: string;
  success: boolean;
  name?: string;
  hasEmbeddedLorebook: boolean;
  embeddedLorebookEntries: number;
  error?: string;
}

export interface CharacterCardDetailFields {
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  exampleDialogs?: string;
  alternateGreetings?: string[];
  creatorNotes?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  characterVersion?: string;
  hasLorebook?: boolean;
  embeddedLorebook?: unknown;
  extensions?: Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function readCharacterCardData(raw: Record<string, unknown>): Record<string, unknown> {
  if (
    (raw.spec === "chara_card_v2" || raw.spec === "chara_card_v3") &&
    raw.data &&
    typeof raw.data === "object" &&
    !Array.isArray(raw.data)
  ) {
    return raw.data as Record<string, unknown>;
  }
  return raw;
}

const CHARACTER_CARD_STRING_FIELDS = [
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
  "creator",
  "character_version",
] as const;

const LEGACY_CHARACTER_CARD_FIELDS: Partial<Record<(typeof CHARACTER_CARD_STRING_FIELDS)[number], readonly string[]>> =
  {
    description: ["char_persona"],
    scenario: ["world_scenario"],
    first_mes: ["char_greeting"],
    mes_example: ["example_dialogue"],
  } as const;

function firstPresentValue(source: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (Object.hasOwn(source, key)) return source[key];
  }
  return undefined;
}

/** Merge only fields explicitly carried by a replacement character-card image. */
export function mergeEmbeddedCharacterCardFields(
  current: CharacterData,
  raw: Record<string, unknown>,
): CharacterData | null {
  const data = readCharacterCardData(raw);
  const next: CharacterData = { ...current, extensions: { ...current.extensions } };
  let foundField = false;

  const name = firstPresentValue(data, ["name", "char_name"]);
  if (typeof name === "string" && name.trim()) {
    next.name = name;
    foundField = true;
  }

  for (const field of CHARACTER_CARD_STRING_FIELDS) {
    const value = firstPresentValue(data, [field, ...(LEGACY_CHARACTER_CARD_FIELDS[field] ?? [])]);
    if (typeof value !== "string") continue;
    next[field] = value;
    foundField = true;
  }

  if (Object.hasOwn(data, "tags") && Array.isArray(data.tags)) {
    next.tags = data.tags.filter((tag): tag is string => typeof tag === "string");
    foundField = true;
  }
  if (Object.hasOwn(data, "alternate_greetings") && Array.isArray(data.alternate_greetings)) {
    next.alternate_greetings = data.alternate_greetings.filter(
      (greeting): greeting is string => typeof greeting === "string",
    );
    foundField = true;
  }

  const extensions = optionalRecord(data.extensions);
  for (const field of ["backstory", "appearance", "world"] as const) {
    if (!Object.hasOwn(extensions ?? {}, field) || typeof extensions?.[field] !== "string") continue;
    next.extensions[field] = extensions[field];
    foundField = true;
  }
  const depthPrompt = optionalRecord(extensions?.depth_prompt);
  if (Object.hasOwn(extensions ?? {}, "depth_prompt") && depthPrompt) {
    next.extensions.depth_prompt = {
      ...current.extensions.depth_prompt,
      ...depthPrompt,
    } as CharacterData["extensions"]["depth_prompt"];
    foundField = true;
  }

  return foundField ? next : null;
}

export function readCharacterCardDetailFields(raw: Record<string, unknown>): CharacterCardDetailFields | null {
  const data = readCharacterCardData(raw);
  const embeddedLorebook = data.character_book;
  const detail: CharacterCardDetailFields = {
    description: optionalString(data.description),
    personality: optionalString(data.personality),
    scenario: optionalString(data.scenario),
    firstMessage: optionalString(data.first_mes),
    exampleDialogs: optionalString(data.mes_example),
    alternateGreetings: optionalStringArray(data.alternate_greetings),
    creatorNotes: optionalString(data.creator_notes),
    systemPrompt: optionalString(data.system_prompt),
    postHistoryInstructions: optionalString(data.post_history_instructions),
    characterVersion: optionalString(data.character_version),
    hasLorebook: hasLorebookEntries(embeddedLorebook),
    embeddedLorebook,
    extensions: optionalRecord(data.extensions),
  };

  return Object.values(detail).some((value) => value !== undefined && value !== false) ? detail : null;
}

export function countLorebookEntries(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const entries = (value as Record<string, unknown>).entries;
  if (Array.isArray(entries)) return entries.length;
  if (entries && typeof entries === "object") return Object.keys(entries).length;
  return 0;
}

export function hasLorebookEntries(value: unknown): boolean {
  return countLorebookEntries(value) > 0;
}

export function readEmbeddedLorebookFromCharacterPayload(raw: Record<string, unknown>): unknown {
  return readCharacterCardData(raw).character_book;
}

export async function inspectCharacterFilesForEmbeddedLorebooks(
  files: File[],
): Promise<EmbeddedLorebookImportPreview[]> {
  if (files.length === 0) return [];

  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }

  const result = await api.upload<{
    success: boolean;
    results: EmbeddedLorebookImportPreview[];
  }>("/import/st-character/inspect", form);

  return result.results.filter((item) => item.success && item.hasEmbeddedLorebook);
}
