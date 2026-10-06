import {
  characterDataSchema,
  normalizeAvatarCrop,
  readImageAppearanceOverride,
  resolveChatPersonaCandidate,
} from "@marinara-engine/shared";
import type { createCharactersStorage } from "./storage/characters.storage.js";

type CharactersStorage = ReturnType<typeof createCharactersStorage>;

export type ChatUserIdentity = {
  source: "persona" | "character";
  id: string;
  name: string;
  phoneticName: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  /**
   * Image-prompt appearance override (#7053) for the IMAGE path only. Empty when
   * the user has not enabled an override, in which case `appearance` is used.
   * Callers must not use this for narrator/roleplay prompt text.
   */
  imageAppearanceOverride: string;
  avatarPath: string | null;
  avatarCrop: unknown;
  nameColor: string | null;
  dialogueColor: string | null;
  boxColor: string | null;
  personaStats?: unknown;
  tags: string[];
  aboutMe: string;
  convoDisplayName: string;
  characterSheetImageId: string | null;
  useCharacterSheetAsReference: boolean;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function resolveChatUserIdentity(
  storage: CharactersStorage,
  chat: {
    personaId?: string | null;
    personaCharacterId?: string | null;
    mode?: string | null;
  },
  // Optional preloaded persona list so hot paths that already listed personas
  // do not repeat the lookup. [PR #5583]
  preloadedPersonas?: Awaited<ReturnType<CharactersStorage["listPersonas"]>>,
): Promise<ChatUserIdentity | null> {
  if (chat.personaCharacterId) {
    const row = await storage.getById(chat.personaCharacterId);
    if (!row) return null;
    let rawData: unknown = row.data;
    if (typeof rawData === "string") {
      try {
        rawData = JSON.parse(rawData);
      } catch {
        return null;
      }
    }
    const parsed = characterDataSchema.safeParse(rawData);
    if (!parsed.success) return null;
    const data = parsed.data;
    const extensions = data.extensions ?? {};
    return {
      source: "character",
      id: row.id,
      name: data.name,
      phoneticName: stringValue(extensions.phoneticName),
      description: data.description,
      personality: data.personality,
      scenario: data.scenario,
      backstory: stringValue(extensions.backstory),
      appearance: stringValue(extensions.appearance),
      imageAppearanceOverride: readImageAppearanceOverride(extensions, null) ?? "",
      avatarPath: row.avatarPath ?? null,
      avatarCrop: normalizeAvatarCrop(extensions.avatarCrop),
      nameColor: stringValue(extensions.nameColor) || null,
      dialogueColor: stringValue(extensions.dialogueColor) || null,
      boxColor: stringValue(extensions.boxColor) || null,
      personaStats: extensions.rpgStats ? { enabled: true, bars: [], rpgStats: extensions.rpgStats } : undefined,
      tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [],
      aboutMe: stringValue(extensions.aboutMe),
      convoDisplayName: stringValue(extensions.convoDisplayName),
      characterSheetImageId: stringValue(extensions.characterSheetImageId) || null,
      useCharacterSheetAsReference:
        extensions.useCharacterSheetAsReference === true || extensions.useCharacterSheetAsReference === "true",
    };
  }

  if (!chat.personaId) return null;
  const personas = preloadedPersonas ?? (await storage.listPersonas());
  const persona = resolveChatPersonaCandidate(personas, chat.personaId);
  if (!persona) return null;
  return {
    source: "persona",
    id: persona.id,
    name: persona.name,
    phoneticName: persona.phoneticName ?? "",
    description: persona.description ?? "",
    personality: persona.personality ?? "",
    scenario: persona.scenario ?? "",
    backstory: persona.backstory ?? "",
    appearance: persona.appearance ?? "",
    // Personas store the override as TOP-LEVEL fields (no extensions bag), so
    // the helper is fed an object literal (#7053, task-7).
    //
    // `listPersonas()` returns RAW storage rows, not projected Personas, so the
    // flag is the table's text convention here — coerce it exactly as
    // `projectPersona` does. The helper's strict `=== true` would otherwise
    // treat a stored "true" as disabled and silently drop the override.
    imageAppearanceOverride:
      readImageAppearanceOverride(
        {
          imageAppearanceEnabled: persona.imageAppearanceEnabled === "true",
          imageAppearance: persona.imageAppearance,
        },
        null,
      ) ?? "",
    avatarPath: persona.avatarPath ?? null,
    avatarCrop: normalizeAvatarCrop(persona.avatarCrop),
    nameColor: persona.nameColor ?? null,
    dialogueColor: persona.dialogueColor ?? null,
    boxColor: persona.boxColor ?? null,
    personaStats: persona.personaStats,
    tags: Array.isArray(persona.tags) ? persona.tags : [],
    aboutMe: persona.aboutMe ?? "",
    convoDisplayName: persona.convoDisplayName ?? "",
    characterSheetImageId: persona.characterSheetImageId ?? null,
    useCharacterSheetAsReference: persona.useCharacterSheetAsReference === "true",
  };
}
