import {
  formatRpgStatsForPrompt,
  nameToXmlTag,
  normalizeRpgStatPools,
  resolveMacros,
  type CharacterMacroProfile,
  type MacroContext,
  type RPGStatsConfig,
} from "@marinara-engine/shared";
import { wrapContent } from "../prompt/format-engine.js";
import { sanitizeExampleDialoguePromptLeaf, sanitizePromptLeaf } from "../prompt/prompt-escaping.js";
import { cardPromptText } from "./generation-text-utils.js";

export type CharacterPromptInfo = {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  creatorNotes: string;
  systemPrompt: string;
  backstory: string;
  appearance: string;
  mesExample: string;
  firstMes: string;
  postHistoryInstructions: string;
  tags: string[];
  talkativeness: number;
  avatarPath: string | null;
  avatarCrop: unknown | null;
  rpgStats?: RPGStatsConfig;
  /** Conversation-only: cosmetic display name + whether to declare it on the card. */
  convoDisplayName?: string;
  convoDisplayNameInCard?: boolean;
};

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown; avatarPath?: string | null } | null>;
};

type GenerationPromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type WrapFormat = "xml" | "markdown" | "none";

/** Normalize persisted character-card RPG data before prompt consumers access it. */
export function normalizeCharacterRpgStats(value: unknown): RPGStatsConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Partial<RPGStatsConfig>;
  if (raw.enabled !== true) return undefined;
  const pools = normalizeRpgStatPools(raw as RPGStatsConfig);
  const attributes = Array.isArray(raw.attributes)
    ? raw.attributes
        .filter(
          (attribute): attribute is { name: string; value: number } =>
            typeof attribute === "object" &&
            attribute !== null &&
            typeof attribute.name === "string" &&
            !!attribute.name.trim() &&
            typeof attribute.value === "number" &&
            Number.isFinite(attribute.value),
        )
        .map((attribute) => ({ name: attribute.name.trim(), value: attribute.value }))
    : [];
  const hpPool = pools[0] ?? { value: 100, max: 100 };
  return {
    enabled: true,
    attributes,
    hp: { value: hpPool.value, max: hpPool.max },
    pools,
  };
}

type CharacterFallbackFieldKey =
  | "description"
  | "personality"
  | "scenario"
  | "backstory"
  | "appearance"
  | "systemPrompt"
  | "mesExample";
type PersonaFallbackFieldKey = "description" | "personality" | "backstory" | "appearance" | "scenario";

const CHARACTER_FALLBACK_FIELDS: Array<{
  key: CharacterFallbackFieldKey;
  label: string;
  macroAliases: string[];
}> = [
  { key: "description", label: "description", macroAliases: ["description"] },
  { key: "personality", label: "personality", macroAliases: ["personality"] },
  { key: "backstory", label: "backstory", macroAliases: ["backstory"] },
  { key: "appearance", label: "appearance", macroAliases: ["appearance"] },
  { key: "scenario", label: "scenario", macroAliases: ["scenario"] },
  { key: "systemPrompt", label: "system_prompt", macroAliases: ["charSysInfo"] },
  { key: "mesExample", label: "example_dialogue", macroAliases: ["example"] },
];

const PERSONA_FALLBACK_FIELDS: Array<{
  key: PersonaFallbackFieldKey;
  label: string;
  macroAliases: string[];
}> = [
  { key: "description", label: "description", macroAliases: ["personaDescription", "persona"] },
  { key: "personality", label: "personality", macroAliases: ["personaPersonality", "persona"] },
  { key: "backstory", label: "backstory", macroAliases: ["personaBackstory", "persona"] },
  { key: "appearance", label: "appearance", macroAliases: ["personaAppearance", "persona"] },
  { key: "scenario", label: "scenario", macroAliases: ["personaScenario", "persona"] },
];

function parseRecord(value: unknown): any {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadCharacterPromptInfo({
  chars,
  characterIds,
  chatMode,
}: {
  chars: CharactersStore;
  characterIds: string[];
  chatMode: string;
}): Promise<CharacterPromptInfo[]> {
  const charInfo: CharacterPromptInfo[] = [];
  for (const cid of characterIds) {
    const charRow = await chars.getById(cid);
    if (!charRow) continue;

    const charData = parseRecord(charRow.data);
    let scenario: string = charData.scenario ?? "";
    if (chatMode !== "conversation" && charData.extensions?.isBuiltInAssistant) {
      scenario = scenario.replace(/<assistant_capabilities>[\s\S]*?<\/assistant_capabilities>/gi, "").trim();
    }
    scenario = cardPromptText(scenario);
    const description = cardPromptText(charData.description);
    charInfo.push({
      id: cid,
      name: charData.name ?? "Unknown",
      description,
      personality: cardPromptText(charData.personality),
      scenario,
      creatorNotes: cardPromptText(charData.creator_notes),
      systemPrompt: cardPromptText(charData.system_prompt),
      backstory: cardPromptText(charData.extensions?.backstory),
      appearance: cardPromptText(charData.extensions?.appearance),
      mesExample: cardPromptText(charData.mes_example),
      firstMes: cardPromptText(charData.first_mes),
      postHistoryInstructions: cardPromptText(charData.post_history_instructions),
      tags: Array.isArray(charData.tags) ? charData.tags.map(String).filter(Boolean) : [],
      talkativeness: Math.max(0, Math.min(1, Number(charData.extensions?.talkativeness ?? 0.5))),
      avatarPath: (charRow.avatarPath as string) ?? null,
      avatarCrop: charData.extensions?.avatarCrop ?? null,
      rpgStats: normalizeCharacterRpgStats(charData.extensions?.rpgStats),
      convoDisplayName:
        typeof charData.extensions?.convoDisplayName === "string" ? charData.extensions.convoDisplayName : undefined,
      convoDisplayNameInCard: charData.extensions?.convoDisplayNameInCard === true,
    });
  }
  return charInfo;
}

export function buildCharacterMacroProfilesById(charInfo: CharacterPromptInfo[]): Map<string, CharacterMacroProfile> {
  return new Map<string, CharacterMacroProfile>(
    charInfo.map((character) => [
      character.id,
      {
        name: character.name,
        description: character.description,
        personality: character.personality,
        backstory: character.backstory,
        appearance: character.appearance,
        scenario: character.scenario,
        example: character.mesExample,
        systemPrompt: character.systemPrompt,
        postHistoryInstructions: character.postHistoryInstructions,
      },
    ]),
  );
}

function wrapFieldEntries(fields: Array<{ label: string; value: string }>, format: WrapFormat): string[] {
  return fields
    .filter(({ value }) => value.trim().length > 0)
    .map(({ label, value }) =>
      wrapContent(
        label === "example_dialogue"
          ? sanitizeExampleDialoguePromptLeaf(value, format)
          : sanitizePromptLeaf(value, format),
        label,
        format,
        2,
      ),
    );
}

function hasNamedProfileBlock(content: string, name: string): boolean {
  const xmlTag = nameToXmlTag(name);
  return (
    content.includes(`<${xmlTag}>`) ||
    content.includes(`<${name}>`) ||
    new RegExp(`^#{1,6} ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(content)
  );
}

function contentIncludesResolvedField(content: string, fieldValue: string): boolean {
  const marker = fieldValue.split("\n")[0]?.trim().slice(0, 80) ?? "";
  return marker.length > 0 && content.includes(marker);
}

function macroAliasPattern(alias: string): RegExp {
  return new RegExp(`\\{\\{[\\s\\S]*?\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[\\s\\S]*?\\}\\}`, "i");
}

function sourceReferencesAnyMacro(sources: readonly string[], aliases: readonly string[]): boolean {
  return aliases.some((alias) => {
    const pattern = macroAliasPattern(alias);
    return sources.some((source) => pattern.test(source));
  });
}

export function injectIdentityFallbackMessages(args: {
  messages: GenerationPromptMessage[];
  charInfo: CharacterPromptInfo[];
  promptTargetCharacterId: string | null;
  promptMacroContext: MacroContext;
  wrapFormat: WrapFormat;
  personaName: string;
  personaDescription: string;
  personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string };
  persona?: { personaStats?: unknown } | null;
  promptTemplateSources?: readonly string[];
  resolvePromptMacros(value: string): string;
  /** Conversation mode only: enables the opt-in per-card convo display-name line.
   *  Gated so the field never reaches RP/VN/Game prompts. */
  isConversation?: boolean;
}): void {
  const allContent = args.messages.map((message) => message.content).join("\n");
  const promptTemplateSources = args.promptTemplateSources ?? [];
  const fallbackCharInfo = args.promptTargetCharacterId
    ? args.charInfo.filter((character) => character.id === args.promptTargetCharacterId)
    : args.charInfo;

  for (const character of fallbackCharInfo) {
    const characterMacroContext = {
      ...args.promptMacroContext,
      char: character.name,
      characterFields: {
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        backstory: character.backstory,
        appearance: character.appearance,
        example: character.mesExample,
        systemPrompt: character.systemPrompt,
        postHistoryInstructions: character.postHistoryInstructions,
      },
    };
    const resolveCharacterMacros = (value: string) => resolveMacros(value, characterMacroContext);
    const resolvedFields: Record<CharacterFallbackFieldKey, string> = {
      description: resolveCharacterMacros(character.description),
      personality: resolveCharacterMacros(character.personality),
      scenario: resolveCharacterMacros(character.scenario),
      backstory: resolveCharacterMacros(character.backstory),
      appearance: resolveCharacterMacros(character.appearance),
      systemPrompt: resolveCharacterMacros(character.systemPrompt),
      mesExample: resolveCharacterMacros(character.mesExample),
    };
    const namedProfilePresent = hasNamedProfileBlock(allContent, character.name);

    // Conversation mode only: when opted in, prefix the card with the character's
    // convo display name so the model can map the display name to this specific
    // card. This is independent from fallback card-field injection so it still
    // appears when normal profile fields are already present.
    const convoName = character.convoDisplayName?.trim();
    const convoNameLine =
      args.isConversation && character.convoDisplayNameInCard && convoName
        ? `Conversation display name: ${sanitizePromptLeaf(convoName, args.wrapFormat)}\n`
        : "";

    const fieldsToInject = CHARACTER_FALLBACK_FIELDS.flatMap((field) => {
      // A custom Conversation prompt may already provide a named profile while
      // omitting the card's Advanced System Prompt. Preserve the custom profile,
      // but never let its presence suppress character-authored instructions.
      if (namedProfilePresent && field.key !== "systemPrompt") return [];
      const value = resolvedFields[field.key];
      if (!value.trim()) return [];
      if (sourceReferencesAnyMacro(promptTemplateSources, field.macroAliases)) return [];
      if (contentIncludesResolvedField(allContent, value)) return [];
      return [{ label: field.label, value }];
    });
    const fieldParts = wrapFieldEntries(fieldsToInject, args.wrapFormat);
    if (fieldParts.length === 0 && !convoNameLine) continue;

    const block = wrapContent(convoNameLine + fieldParts.join("\n"), character.name, args.wrapFormat, 1);
    const firstSysIdx = args.messages.findIndex((message) => message.role === "system");
    const insertAt = firstSysIdx >= 0 ? firstSysIdx + 1 : 0;
    args.messages.splice(insertAt, 0, { role: "system", content: block });
  }

  const resolvedPersonaFields: Record<PersonaFallbackFieldKey, string> = {
    description: args.resolvePromptMacros(args.personaDescription),
    personality: args.resolvePromptMacros(args.personaFields.personality ?? ""),
    backstory: args.resolvePromptMacros(args.personaFields.backstory ?? ""),
    appearance: args.resolvePromptMacros(args.personaFields.appearance ?? ""),
    scenario: args.resolvePromptMacros(args.personaFields.scenario ?? ""),
  };

  if (hasNamedProfileBlock(allContent, args.personaName)) return;

  const fieldParts = wrapFieldEntries(
    PERSONA_FALLBACK_FIELDS.flatMap((field) => {
      const value = resolvedPersonaFields[field.key];
      if (!value.trim()) return [];
      if (sourceReferencesAnyMacro(promptTemplateSources, field.macroAliases)) return [];
      if (contentIncludesResolvedField(allContent, value)) return [];
      return [{ label: field.label, value }];
    }),
    args.wrapFormat,
  );

  if (args.persona?.personaStats) {
    const pStats = parseRecord(args.persona.personaStats);
    if (pStats?.rpgStats?.enabled) {
      const rpgText = formatRpgStatsForPrompt(pStats.rpgStats as RPGStatsConfig);
      fieldParts.push(wrapContent(sanitizePromptLeaf(rpgText, args.wrapFormat), "rpg_attributes", args.wrapFormat, 2));
    }
  }

  if (fieldParts.length === 0) return;

  const block = wrapContent(fieldParts.join("\n"), args.personaName, args.wrapFormat, 1);
  const firstUserIdx = args.messages.findIndex((message) => message.role === "user" || message.role === "assistant");
  const insertAt = firstUserIdx >= 0 ? firstUserIdx : args.messages.length;
  args.messages.splice(insertAt, 0, { role: "system", content: block });
}
