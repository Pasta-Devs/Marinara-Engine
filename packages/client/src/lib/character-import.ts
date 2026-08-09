import { api } from "./api-client";

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

export function readCharacterCardDetailFields(raw: Record<string, unknown>): CharacterCardDetailFields | null {
  const data =
    (raw.spec === "chara_card_v2" || raw.spec === "chara_card_v3") &&
    raw.data &&
    typeof raw.data === "object" &&
    !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : raw;
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
  const target =
    (raw.spec === "chara_card_v2" || raw.spec === "chara_card_v3") &&
    raw.data &&
    typeof raw.data === "object" &&
    !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : raw;

  return target.character_book;
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
