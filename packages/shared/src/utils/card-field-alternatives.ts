import {
  cardFieldAlternativeSchema,
  cardFieldAlternativesSchema,
  type CardFieldAlternative,
} from "../schemas/card-field-alternative.schema.js";
import type { CardFieldKey } from "../types/card-field.js";

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Stored Persona arrays are serialized; character extensions use decoded arrays. */
export function normalizeCardFieldAlternatives(value: unknown): CardFieldAlternative[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  const parsed = cardFieldAlternativesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function unassignCardFieldAlternatives(value: unknown): CardFieldAlternative[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      // Let the strict array schema report malformed portable input as a validation error.
    }
  }
  const alternatives = cardFieldAlternativeSchema.array().parse(value === undefined ? [] : value);
  return cardFieldAlternativesSchema.parse(alternatives.map((alternative) => ({ ...alternative, chatIds: [] })));
}

/** The same membership rule is used by the picker API and prompt reads. */
export function cardEntityBelongsToChat(chatValue: unknown, kind: "character" | "persona", entityId: string): boolean {
  const chat = record(chatValue);
  const metadata = record(chat.metadata);
  const setup = record(metadata.gameSetupConfig);
  if (kind === "persona") {
    if (chat.personaCharacterId) return false;
    return (chat.personaId || (chat.mode === "game" ? setup.personaId : null)) === entityId;
  }
  let characterIds = chat.characterIds;
  if (typeof characterIds === "string") {
    try {
      characterIds = JSON.parse(characterIds);
    } catch {
      characterIds = [];
    }
  }
  if ((Array.isArray(characterIds) && characterIds.includes(entityId)) || chat.personaCharacterId === entityId)
    return true;
  if (chat.mode !== "game") return false;
  const gmId = Object.hasOwn(metadata, "gameGmCharacterId") ? metadata.gameGmCharacterId : setup.gmCharacterId;
  const partyIds = Array.isArray(metadata.gamePartyCharacterIds)
    ? metadata.gamePartyCharacterIds
    : setup.partyCharacterIds;
  return gmId === entityId || (Array.isArray(partyIds) && partyIds.includes(entityId));
}

export function cardFieldAlternativeValues(
  value: unknown,
  chatId: string | undefined,
): Partial<Record<CardFieldKey, string>> {
  if (!chatId) return {};
  return Object.fromEntries(
    normalizeCardFieldAlternatives(value)
      .filter((alternative) => alternative.chatIds.includes(chatId))
      .map((alternative) => [alternative.field, alternative.value]),
  );
}

/** Pure projection: the authored card and its extension bag are never mutated. */
export function applyCharacterCardFieldAlternatives<T extends Record<string, unknown>>(
  data: T,
  chatId: string | undefined,
): T {
  const extensions = record(data.extensions);
  const values = cardFieldAlternativeValues(extensions.cardFieldAlternatives, chatId);
  if (Object.keys(values).length === 0) return data;
  const projected: Record<string, unknown> = { ...data, extensions: { ...extensions } };
  for (const [field, value] of Object.entries(values)) {
    if (field === "backstory" || field === "appearance") {
      (projected.extensions as Record<string, unknown>)[field] = value;
      // Legacy imports also carry these at the top level. Empty replacements
      // must not fall through to an authored legacy value in older consumers.
      if (Object.hasOwn(projected, field)) projected[field] = value;
    } else projected[field] = value;
  }
  return projected as T;
}

export function applyPersonaCardFieldAlternatives<T extends { cardFieldAlternatives?: unknown }>(
  persona: T,
  chatId: string | undefined,
): T {
  const values = cardFieldAlternativeValues(persona.cardFieldAlternatives, chatId);
  return Object.keys(values).length ? { ...persona, ...values } : persona;
}
