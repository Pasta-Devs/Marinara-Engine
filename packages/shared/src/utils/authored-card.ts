import type { CharacterData, CharacterExtensions } from "../types/character.js";
import type { Persona } from "../types/persona.js";
import { characterExtensionsSchema } from "../schemas/character.schema.js";
import { unassignCardFieldAlternatives } from "./card-field-alternatives.js";
import { normalizeAvatarCrop } from "./avatar-crop.js";
import {
  normalizePersonaStats,
  normalizePersonaStringArray,
  normalizeTrackerCardColorConfig,
} from "./persona-normalization.js";

type PersonaRecordKey = "id" | "comment" | "avatarPath" | "createdAt" | "updatedAt" | "isActive";
export type AuthoredPersona = Omit<Persona, PersonaRecordKey>;

function commonFields({
  name,
  description,
  personality,
  scenario,
  summary,
  mes_example,
  creator,
  tags,
}: AuthoredPersona | CharacterData) {
  // Older or imported drafts can arrive without tags; the persona API expects an array.
  return {
    name,
    description,
    personality,
    scenario,
    summary,
    mes_example: mes_example ?? "",
    creator,
    tags: tags ?? [],
  };
}

function commonExtensions(source: AuthoredPersona | CharacterExtensions) {
  return {
    backstory: source.backstory,
    appearance: source.appearance,
    versioningEnabled: source.versioningEnabled !== false,
    cardFieldAlternatives: source.cardFieldAlternatives,
    imageAppearance: source.imageAppearance,
    imageAppearanceEnabled: source.imageAppearanceEnabled,
    characterSheetImageId: source.characterSheetImageId,
    useCharacterSheetAsReference: source.useCharacterSheetAsReference,
    convoDisplayName: source.convoDisplayName,
    aboutMe: source.aboutMe,
    convoBehavior: source.convoBehavior,
  };
}

/** A new record has no ownership of gallery images or chat-specific assignments on its source. */
export function independentCardFields(fields: AuthoredPersona): AuthoredPersona {
  const stats = fields.personaStats;
  return {
    ...fields,
    avatarCrop: undefined,
    characterSheetImageId: undefined,
    useCharacterSheetAsReference: undefined,
    cardFieldAlternatives: unassignCardFieldAlternatives(fields.cardFieldAlternatives),
    personaStats: stats?.combatIcon?.source === "image" ? { ...stats, combatIcon: undefined } : stats,
  };
}

/** Overlay a complete, decoded draft. The base retains greetings, lore and foreign extensions. */
export function cardFromPersona(persona: AuthoredPersona, base?: CharacterData): CharacterData {
  const roleDefaults = base ?? {
    first_mes: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    character_book: null,
  };
  const { rpgStats, combatIcon, rulesetSheets, ...bars } = persona.personaStats ?? {};
  return {
    ...roleDefaults,
    ...commonFields(persona),
    character_version: persona.personaVersion,
    creator_notes: persona.creatorNotes,
    extensions: {
      ...(base?.extensions ?? characterExtensionsSchema.parse({})),
      ...commonExtensions(persona),
      phoneticName: persona.phoneticName,
      avatarCrop: persona.avatarCrop,
      nameColor: persona.nameColor,
      dialogueColor: persona.dialogueColor,
      boxColor: persona.boxColor,
      trackerCardColors: persona.trackerCardColors,
      savedStatusOptions: persona.savedStatusOptions,
      // RPG settings already have card slots. The player's status bars have their own lifetime.
      personaStats: persona.personaStats && bars,
      rpgStats,
      combatIcon,
      rulesetSheets,
    },
  };
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function defaultPersonaBars() {
  return [
    { name: "Satiety", value: 100, max: 100, color: "#f59e0b" },
    { name: "Energy", value: 100, max: 100, color: "#22c55e" },
    { name: "Hygiene", value: 100, max: 100, color: "#3b82f6" },
    { name: "Mood", value: 100, max: 100, color: "#eab308" },
  ];
}

/** Project a card into the legacy authored fields. Record metadata comes from its owner. */
export function personaFromCard(card: CharacterData): AuthoredPersona {
  const ext = card.extensions;
  const bars = normalizePersonaStats(ext.personaStats);
  const hasGameSettings = ext.rpgStats || ext.combatIcon || ext.rulesetSheets;
  return {
    ...commonFields(card),
    ...commonExtensions(ext),
    creatorNotes: card.creator_notes,
    personaVersion: card.character_version,
    phoneticName: stringOrUndefined(ext.phoneticName),
    avatarCrop: ext.avatarCrop === undefined ? undefined : normalizeAvatarCrop(ext.avatarCrop),
    nameColor: ext.nameColor ?? "",
    dialogueColor: ext.dialogueColor ?? "",
    boxColor: ext.boxColor ?? "",
    trackerCardColors: normalizeTrackerCardColorConfig(ext.trackerCardColors),
    savedStatusOptions: normalizePersonaStringArray(ext.savedStatusOptions),
    personaStats:
      bars || hasGameSettings
        ? {
            ...(bars ?? { enabled: ext.rpgStats?.enabled ?? false, bars: defaultPersonaBars() }),
            rpgStats: ext.rpgStats,
            combatIcon: ext.combatIcon,
            rulesetSheets: ext.rulesetSheets,
          }
        : undefined,
  };
}
