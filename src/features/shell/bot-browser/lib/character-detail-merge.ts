import { hasLorebookEntries } from "../../../../shared/lib/character-import";

export interface CharacterDetailImportData {
  embeddedLorebook?: unknown;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  characterVersion?: string;
  providerExtensions?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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
    ["system_prompt", detail.systemPrompt],
    ["post_history_instructions", detail.postHistoryInstructions],
    ["character_version", detail.characterVersion],
  ];
  for (const [key, value] of fieldMap) {
    const text = nonEmptyString(value);
    if (text) target[key] = text;
  }

  if (isRecord(detail.providerExtensions)) {
    const existingExtensions = isRecord(target.extensions) ? target.extensions : {};
    target.extensions = { ...detail.providerExtensions, ...existingExtensions };
  }

  if (target !== cloned) {
    cloned.data = target;
  }

  return cloned;
}
