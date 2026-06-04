import { hasLorebookEntries } from "../../../../shared/lib/character-import";

export interface CharacterDetailImportData {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  exampleDialogs?: string;
  alternateGreetings?: string[];
  creatorNotes?: string;
  embeddedLorebook?: unknown;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  creator?: string;
  tags?: string[];
  characterVersion?: string;
  providerExtensions?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function setStringField(target: Record<string, unknown>, key: string, value: unknown) {
  if (typeof value === "string" && value.trim()) target[key] = value;
}

export function mergeCharacterDetailIntoCharacterJson(
  raw: Record<string, unknown>,
  detail: CharacterDetailImportData | null | undefined,
) {
  if (!detail) return raw;

  const cloned: Record<string, unknown> = { ...raw };
  const target =
    (cloned.spec === "chara_card_v2" || cloned.spec === "chara_card_v3") && isRecord(cloned.data)
      ? { ...cloned.data }
      : cloned;

  if (hasLorebookEntries(detail.embeddedLorebook) && !target.character_book) {
    target.character_book = detail.embeddedLorebook;
  }

  const fieldMap: Array<[string, unknown]> = [
    ["description", detail.description],
    ["personality", detail.personality],
    ["scenario", detail.scenario],
    ["first_mes", detail.firstMessage],
    ["mes_example", detail.exampleDialogs],
    ["creator_notes", detail.creatorNotes],
    ["system_prompt", detail.systemPrompt],
    ["post_history_instructions", detail.postHistoryInstructions],
    ["character_version", detail.characterVersion],
  ];
  for (const [key, value] of fieldMap) {
    setStringField(target, key, value);
  }

  setStringField(target, "name", detail.name);
  setStringField(target, "creator", detail.creator);
  if (Array.isArray(detail.tags)) target.tags = detail.tags;
  if (Array.isArray(detail.alternateGreetings)) target.alternate_greetings = detail.alternateGreetings;

  if (isRecord(detail.providerExtensions)) {
    const existingExtensions = isRecord(target.extensions) ? target.extensions : {};
    target.extensions = { ...existingExtensions, ...detail.providerExtensions };
  }

  if (target !== cloned) {
    cloned.data = target;
  }

  return cloned;
}
