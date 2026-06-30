import {
  formatRpgStatsForPrompt,
  nameToXmlTag,
  resolveMacros,
  type CharacterMacroProfile,
  type MacroContext,
  type RPGStatsConfig,
} from "@marinara-engine/shared";
import { wrapContent } from "../prompt/format-engine.js";
import { sanitizePromptLeaf } from "../prompt/prompt-escaping.js";
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
};

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown; avatarPath?: string | null } | null>;
};

type GenerationPromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type WrapFormat = "xml" | "markdown" | "none";

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

function wrapFields(fields: Record<string, string>, format: WrapFormat): string[] {
  return Object.entries(fields)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => wrapContent(sanitizePromptLeaf(value, format), key, format, 2));
}

function hasProfileBlock(content: string, name: string, description: string): boolean {
  const xmlTag = nameToXmlTag(name);
  return (
    (description && content.includes(description.split("\n")[0]!.trim().slice(0, 80))) ||
    content.includes(`<${xmlTag}>`) ||
    content.includes(`<${name}>`) ||
    new RegExp(`^#{1,6} ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(content)
  );
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
  resolvePromptMacros(value: string): string;
}): void {
  const allContent = args.messages.map((message) => message.content).join("\n");
  const fallbackCharInfo = args.promptTargetCharacterId
    ? args.charInfo.filter((character) => character.id === args.promptTargetCharacterId)
    : args.charInfo;

  for (const character of fallbackCharInfo) {
    if (hasProfileBlock(allContent, character.name, character.description) || !character.description) continue;

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
    const fieldParts = wrapFields(
      {
        description: resolveCharacterMacros(character.description),
        personality: resolveCharacterMacros(character.personality),
        scenario: resolveCharacterMacros(character.scenario),
        backstory: resolveCharacterMacros(character.backstory),
        appearance: resolveCharacterMacros(character.appearance),
        system_prompt: resolveCharacterMacros(character.systemPrompt),
        example_dialogue: resolveCharacterMacros(character.mesExample),
      },
      args.wrapFormat,
    );
    if (fieldParts.length === 0) continue;

    const block = wrapContent(fieldParts.join("\n"), character.name, args.wrapFormat, 1);
    const firstSysIdx = args.messages.findIndex((message) => message.role === "system");
    const insertAt = firstSysIdx >= 0 ? firstSysIdx + 1 : 0;
    args.messages.splice(insertAt, 0, { role: "system", content: block });
  }

  if (!args.personaDescription || hasProfileBlock(allContent, args.personaName, args.personaDescription)) return;

  const fieldParts = wrapFields(
    {
      description: args.resolvePromptMacros(args.personaDescription),
      personality: args.resolvePromptMacros(args.personaFields.personality ?? ""),
      backstory: args.resolvePromptMacros(args.personaFields.backstory ?? ""),
      appearance: args.resolvePromptMacros(args.personaFields.appearance ?? ""),
      scenario: args.resolvePromptMacros(args.personaFields.scenario ?? ""),
    },
    args.wrapFormat,
  );

  if (args.persona?.personaStats) {
    const pStats = parseRecord(args.persona.personaStats);
    if (pStats?.rpgStats?.enabled) {
      const rpgText = formatRpgStatsForPrompt(pStats.rpgStats as RPGStatsConfig);
      fieldParts.push(
        wrapContent(sanitizePromptLeaf(rpgText, args.wrapFormat), "rpg_attributes", args.wrapFormat, 2),
      );
    }
  }

  if (fieldParts.length === 0) return;

  const block = wrapContent(fieldParts.join("\n"), args.personaName, args.wrapFormat, 1);
  const firstUserIdx = args.messages.findIndex((message) => message.role === "user" || message.role === "assistant");
  const insertAt = firstUserIdx >= 0 ? firstUserIdx : args.messages.length;
  args.messages.splice(insertAt, 0, { role: "system", content: block });
}
