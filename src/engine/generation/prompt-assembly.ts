import type { LorebookEntry, LorebookMatchingSource } from "../contracts/types/lorebook";
import type { ChatMLMessage, MarkerConfig, WrapFormat } from "../contracts/types/prompt";
import type { CharacterData } from "../contracts/types/character";
import type { StorageGateway } from "../capabilities/storage";
import { getCharacterDescriptionWithExtensions } from "../generation-core/prompt/character-description-extensions";
import {
  applyTokenBudgetWithSkipped,
  injectAtDepth,
  processActivatedEntries,
  type BudgetSkippedActivatedEntry,
} from "../generation-core/lorebooks/prompt-injector";
import {
  recursiveScan,
  scanForActivatedEntries,
  type ActivatedEntry,
  type ScanMessage,
  type ScanOptions,
} from "../generation-core/lorebooks/keyword-scanner";
import { resolveGameLorebookScopeExclusions } from "../generation-core/lorebooks/game-lorebook-scope";
import { wrapContent } from "../generation-core/prompt/format-engine";
import { mergeAdjacentMessages, squashLeadingSystemMessages } from "../generation-core/prompt/merger";
import { applyRegexScriptsToPromptMessages } from "../generation-core/regex/regex-application";
import { stripConversationPromptTimestamps } from "../modes/chat/core/summaries/transcript-sanitize";
import { resolveMacros, type MacroContext } from "../shared/macros/macro-engine";
import { collapseExcessBlankLines } from "../shared/text/newlines";
import { cleanPromptText, stripPromptComments } from "../shared/text/prompt-comments";
import { normalizeUserTimeZone } from "../shared/time/timezone";
import type {
  GameActiveState,
  GameCampaignPlan,
  GameMap,
  GameNpc,
  HudWidget,
  SessionSummary,
} from "../contracts/types/game";
import { buildGmFormatReminder, buildGmSystemPrompt, type GmPromptContext } from "../modes/game/prompts/gm-prompts";
import { formatPerceptionHints, generatePerceptionHints } from "../modes/game/mechanics/perception.service";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { activeCharacterIds } from "./active-characters";
import {
  generationParameterSources,
  mergeStoredGenerationParameters,
  type StoredGenerationParameters,
} from "./generate-route-utils";
import { buildGenerationPromptPresetCandidates } from "./prompt-preset-selection";
import { LIMITS } from "../contracts/constants/defaults";
import {
  bySortOrder,
  boolish,
  hiddenFromAi,
  isRecord,
  parseArray,
  parseRecord,
  readNumber,
  readString,
  stringArray,
  type JsonRecord,
} from "./runtime-records";

export interface GenerationCharacterContext {
  id: string;
  name: string;
  description: string;
  personality?: string;
  scenario?: string;
  creatorNotes?: string;
  systemPrompt?: string;
  backstory?: string;
  appearance?: string;
  mesExample?: string;
  firstMes?: string;
  postHistoryInstructions?: string;
  tags: string[];
}

export interface GenerationPersonaContext {
  name: string;
  description: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
  tags: string[];
  personaStats?: { enabled: boolean; bars: Array<{ name: string; value: number; max: number; color: string }> };
  rpgStats?: {
    enabled: boolean;
    attributes: Array<{ name: string; value: number }>;
    hp: { value: number; max: number };
  };
}

export interface BudgetSkippedLorebookEntry {
  id: string;
  name: string;
  lorebookId: string;
  lorebookName: string;
  matchedKeys: string[];
  estimatedTokens: number;
  lorebookBudget: number;
  lorebookUsedTokens: number;
  chatBudget: number;
  chatUsedTokens: number;
  blockedBy: "lorebook" | "chat" | "both";
}

export interface PromptAssemblyResult {
  messages: ChatMLMessage[];
  previewMessages: ChatMLMessage[];
  promptPresetId: string | null;
  parameters: StoredGenerationParameters | null;
  wrapFormat: WrapFormat;
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  activatedLorebookEntries: Array<{
    id: string;
    lorebookId: string;
    name: string;
    content: string;
    tag: string;
    matchedKeys: string[];
    order: number;
    constant: boolean;
  }>;
  budgetSkippedLorebookEntries: BudgetSkippedLorebookEntry[];
  chatSummary: string | null;
  chatSummaryFingerprint: string | null;
}

export interface PromptAssemblyInput {
  chat: JsonRecord;
  storedMessages: JsonRecord[];
  connection: JsonRecord;
  request: JsonRecord;
  latestUserInput: string;
  agentData?: Record<string, string>;
  embeddingSource?: { embed(texts: string[]): Promise<number[][] | null> } | null;
}

type PromptSectionRecord = JsonRecord & {
  role?: unknown;
  content?: unknown;
  name?: unknown;
  identifier?: unknown;
  markerConfig?: unknown;
};

type PromptChoiceBlockRecord = JsonRecord & {
  variableName?: unknown;
  separator?: unknown;
  randomPick?: unknown;
};

interface SelectedPromptPreset {
  id: string;
  preset: JsonRecord | null;
  sections: PromptSectionRecord[];
  variables: Record<string, string>;
  parameters: StoredGenerationParameters | null;
  wrapFormat: WrapFormat | null;
}

const PARTY_NPC_ID_PREFIX = "npc:";

function dataRecord(record: JsonRecord): JsonRecord {
  const data = parseRecord(record.data);
  return Object.keys(data).length > 0 ? data : record;
}

function field(source: JsonRecord, key: string): string {
  return cleanPromptText(readString(source[key]));
}

function stringRecord(value: unknown): Record<string, string> {
  const record = parseRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1]),
      )
      .map(([key, entry]) => [key, String(entry)]),
  );
}

function normalizeWrapFormat(value: unknown): WrapFormat | null {
  return value === "xml" || value === "markdown" || value === "none" ? value : null;
}

function normalizedSelectionValue(value: unknown, block?: PromptChoiceBlockRecord): string | null {
  if (Array.isArray(value)) {
    const values = value
      .map((entry) =>
        typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" ? String(entry) : "",
      )
      .filter(Boolean);
    if (values.length === 0) return null;
    if (boolish(block?.randomPick, false)) {
      return values[Math.floor(Math.random() * values.length)] ?? values[0] ?? null;
    }
    return values.join(readString(block?.separator, ", "));
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function promptChoiceVariables(
  rawChoices: unknown,
  blocksByName: Map<string, PromptChoiceBlockRecord>,
): Record<string, string> {
  const choices = parseRecord(rawChoices);
  const variables: Record<string, string> = {};
  for (const [name, value] of Object.entries(choices)) {
    const normalized = normalizedSelectionValue(value, blocksByName.get(name));
    if (normalized !== null) variables[name] = normalized;
  }
  return variables;
}

function loadCharacterContext(record: JsonRecord): GenerationCharacterContext {
  const data = dataRecord(record);
  const extensions = parseRecord(data.extensions);
  const name = field(data, "name") || field(record, "name") || "Character";
  return {
    id: field(record, "id") || field(data, "id") || name,
    name,
    description:
      cleanPromptText(getCharacterDescriptionWithExtensions(data as unknown as CharacterData)) ||
      field(data, "description") ||
      field(record, "description"),
    personality: field(data, "personality") || undefined,
    scenario: field(data, "scenario") || undefined,
    creatorNotes: field(data, "creator_notes") || field(data, "creatorNotes") || undefined,
    systemPrompt: field(data, "system_prompt") || field(data, "systemPrompt") || undefined,
    backstory: field(data, "backstory") || field(extensions, "backstory") || undefined,
    appearance: field(data, "appearance") || field(extensions, "appearance") || undefined,
    mesExample: field(data, "mes_example") || field(data, "mesExample") || undefined,
    firstMes: field(data, "first_mes") || field(data, "firstMes") || undefined,
    postHistoryInstructions:
      field(data, "post_history_instructions") || field(data, "postHistoryInstructions") || undefined,
    tags: stringArray(data.tags ?? record.tags),
  };
}

function loadPersonaContext(record: JsonRecord): GenerationPersonaContext {
  const data = dataRecord(record);
  return {
    name: field(data, "name") || field(record, "name") || "User",
    description: field(data, "description") || field(record, "description"),
    personality: field(data, "personality") || undefined,
    backstory: field(data, "backstory") || undefined,
    appearance: field(data, "appearance") || undefined,
    scenario: field(data, "scenario") || undefined,
    tags: stringArray(data.tags ?? record.tags),
    personaStats: isPersonaStats(data.personaStats),
    rpgStats: isRpgStats(data.rpgStats),
  };
}

function isPersonaStats(value: unknown): GenerationPersonaContext["personaStats"] | undefined {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || !Array.isArray(value.bars)) return undefined;
  const bars = value.bars.filter(
    (bar): bar is { name: string; value: number; max: number; color: string } =>
      isRecord(bar) &&
      typeof bar.name === "string" &&
      typeof bar.value === "number" &&
      typeof bar.max === "number" &&
      typeof bar.color === "string",
  );
  return { enabled: value.enabled, bars };
}

function isRpgStats(value: unknown): GenerationPersonaContext["rpgStats"] | undefined {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || !isRecord(value.hp)) return undefined;
  const attributes = Array.isArray(value.attributes)
    ? value.attributes.filter(
        (attr): attr is { name: string; value: number } =>
          isRecord(attr) && typeof attr.name === "string" && typeof attr.value === "number",
      )
    : [];
  const hp = {
    value: readNumber(value.hp.value, 0),
    max: readNumber(value.hp.max, 0),
  };
  return { enabled: value.enabled, attributes, hp };
}

async function loadCharacters(storage: StorageGateway, chat: JsonRecord): Promise<GenerationCharacterContext[]> {
  const ids = activeCharacterIds(chat);
  const rows = await Promise.all(ids.map((id) => storage.get<JsonRecord>("characters", id)));
  return rows.filter(isRecord).map(loadCharacterContext);
}

async function loadPersona(storage: StorageGateway, chat: JsonRecord): Promise<GenerationPersonaContext | null> {
  const personaId = readString(chat.personaId).trim();
  if (personaId) {
    const row = await storage.get<JsonRecord>("personas", personaId);
    return isRecord(row) ? loadPersonaContext(row) : null;
  }
  const active = (await storage.list<JsonRecord>("personas")).find(
    (persona) => boolish(persona.isActive, false) || boolish(persona.active, false),
  );
  return active ? loadPersonaContext(active) : null;
}

function buildPartyNpcId(name: string): string {
  return `${PARTY_NPC_ID_PREFIX}${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function isPartyNpcId(id: string): boolean {
  return id.startsWith(PARTY_NPC_ID_PREFIX);
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function gameCardByName(meta: JsonRecord): Map<string, JsonRecord> {
  const cards = recordArray(meta.gameCharacterCards);
  const byName = new Map<string, JsonRecord>();
  for (const card of cards) {
    const name = readString(card.name).trim().toLowerCase();
    if (name) byName.set(name, card);
  }
  return byName;
}

function appendGameCardFields(parts: string[], card: JsonRecord | undefined): void {
  if (!card) return;
  const className = readString(card.class).trim();
  if (className) parts.push(`Class: ${className}`);
  const abilities = stringArray(card.abilities);
  if (abilities.length) parts.push(`Abilities: ${abilities.join(", ")}`);
  const strengths = stringArray(card.strengths);
  if (strengths.length) parts.push(`Strengths: ${strengths.join(", ")}`);
  const weaknesses = stringArray(card.weaknesses);
  if (weaknesses.length) parts.push(`Weaknesses: ${weaknesses.join(", ")}`);
  const extra = parseRecord(card.extra);
  for (const [key, value] of Object.entries(extra)) {
    const text = readString(value).trim();
    if (text) parts.push(`${key}: ${text}`);
  }
  const rpgStats = parseRecord(card.rpgStats);
  const attributes = recordArray(rpgStats.attributes)
    .map((attribute) => {
      const name = readString(attribute.name).trim();
      const value = readNumber(attribute.value, Number.NaN);
      return name && Number.isFinite(value) ? `${name}: ${value}` : "";
    })
    .filter(Boolean);
  if (attributes.length > 0) parts.push(`RPG Attributes: ${attributes.join(", ")}`);
  const hp = parseRecord(rpgStats.hp);
  const hpValue = readNumber(hp.value, Number.NaN);
  const hpMax = readNumber(hp.max, Number.NaN);
  if (Number.isFinite(hpValue) || Number.isFinite(hpMax)) {
    parts.push(`RPG HP: ${Number.isFinite(hpValue) ? hpValue : "?"}/${Number.isFinite(hpMax) ? hpMax : "?"}`);
  }
}

function characterCardText(character: GenerationCharacterContext, gameCard?: JsonRecord): string {
  const parts = [`Name: ${character.name}`];
  if (character.personality) parts.push(`Personality: ${character.personality}`);
  if (character.description) parts.push(`Description: ${character.description}`);
  if (character.backstory) parts.push(`Backstory: ${character.backstory}`);
  if (character.appearance) parts.push(`Appearance: ${character.appearance}`);
  if (character.scenario) parts.push(`Scenario: ${character.scenario}`);
  appendGameCardFields(parts, gameCard);
  return parts.join("\n");
}

function personaCardText(persona: GenerationPersonaContext | null, gameCard?: JsonRecord): string | null {
  if (!persona) return null;
  const parts = [`Name: ${persona.name}`];
  if (persona.description) parts.push(`Description: ${persona.description}`);
  if (persona.personality) parts.push(`Personality: ${persona.personality}`);
  if (persona.backstory) parts.push(`Backstory: ${persona.backstory}`);
  if (persona.appearance) parts.push(`Appearance: ${persona.appearance}`);
  if (persona.scenario) parts.push(`Scenario: ${persona.scenario}`);
  appendGameCardFields(parts, gameCard);
  return parts.join("\n");
}

function npcPartyCardText(npc: GameNpc, gameCard?: JsonRecord): string {
  const parts = [`Name: ${npc.name}`, "Source: Tracked NPC companion, not a character-library card"];
  if (npc.description) parts.push(`Description: ${npc.description}`);
  if (npc.location) parts.push(`Last Known Location: ${npc.location}`);
  if (Array.isArray(npc.notes) && npc.notes.length) parts.push(`Notes: ${npc.notes.join("; ")}`);
  appendGameCardFields(parts, gameCard);
  return parts.join("\n");
}

async function loadCharacterById(
  storage: StorageGateway,
  characterId: string,
  existing: Map<string, GenerationCharacterContext>,
): Promise<GenerationCharacterContext | null> {
  const cached = existing.get(characterId);
  if (cached) return cached;
  const row = await storage.get<JsonRecord>("characters", characterId);
  return isRecord(row) ? loadCharacterContext(row) : null;
}

function normalizeGameInventory(value: unknown): Array<{ name: string; quantity: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [{ name: item.trim(), quantity: 1 }] : [];
    if (!isRecord(item)) return [];
    const name = readString(item.name ?? item.item).trim();
    if (!name) return [];
    const quantity = Math.max(1, readNumber(item.quantity ?? item.count, 1));
    return [{ name, quantity }];
  });
}

function latestUserContent(messages: JsonRecord[], fallback: string): string {
  const latest = [...messages].reverse().find((message) => readString(message.role) === "user");
  return readString(latest?.content).trim() || fallback.trim();
}

function gameAddressMode(content: string): "party" | "gm" | undefined {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("[To the party]")) return "party";
  if (trimmed.startsWith("[To the GM]")) return "gm";
  return undefined;
}

function gameTimeAndWeather(chat: JsonRecord, meta: JsonRecord): { gameTime?: string; weatherContext?: string } {
  const state = parseRecord(chat.gameState ?? meta.gameState);
  const weather = readString(state.weather).trim();
  const temperature = readString(state.temperature).trim();
  const date = readString(state.date).trim();
  const time = readString(state.time).trim();
  return {
    weatherContext: weather ? `Current weather: ${weather}${temperature ? `, ${temperature}` : ""}` : undefined,
    gameTime: [date, time].filter(Boolean).join(", ") || undefined,
  };
}

function normalizedRecordKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readNormalizedNumber(record: JsonRecord, keys: string[], fallback: number): number {
  const wanted = new Set(keys.map(normalizedRecordKey));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(normalizedRecordKey(key))) {
      return readNumber(value, fallback);
    }
  }
  return fallback;
}

function readPersonaAttribute(persona: GenerationPersonaContext | null, keys: string[]): number | null {
  const wanted = new Set(keys.map(normalizedRecordKey));
  for (const attribute of persona?.rpgStats?.attributes ?? []) {
    if (wanted.has(normalizedRecordKey(attribute.name))) {
      return readNumber(attribute.value, Number.NaN);
    }
  }
  return null;
}

function normalizePerceptionToken(value: unknown): string | null {
  const raw = readString(value).trim();
  if (!raw) return null;
  const parenthetical = raw.match(/\(([^)]+)\)/)?.[1]?.trim();
  return (parenthetical || raw).toLowerCase().replace(/[\s-]+/g, "_");
}

function buildGamePerceptionHints(
  chat: JsonRecord,
  meta: JsonRecord,
  persona: GenerationPersonaContext | null,
): string | undefined {
  const state = parseRecord(chat.gameState ?? meta.gameState);
  const playerStats = parseRecord(state.playerStats);
  const attributes = parseRecord(playerStats.attributes);
  const skills = parseRecord(playerStats.skills);
  const personaWisdom = readPersonaAttribute(persona, ["wis", "wisdom"]);
  const wisdomScore = readNormalizedNumber(attributes, ["wis", "wisdom"], personaWisdom ?? 10);
  const dangerLevel = readNormalizedNumber(state, ["dangerLevel"], readNormalizedNumber(meta, ["gameDangerLevel"], Number.NaN));
  const presentNpcNames = recordArray(state.presentCharacters)
    .map((character) => readString(character.name).trim())
    .filter(Boolean);
  const hints = generatePerceptionHints({
    perceptionMod: readNormalizedNumber(skills, ["perception", "perceptionMod", "perceptionModifier"], 0),
    wisdomScore,
    gameState: readString(meta.gameActiveState, "exploration") || "exploration",
    location: readString(state.location).trim() || null,
    weather: normalizePerceptionToken(state.weather),
    timeOfDay: normalizePerceptionToken(state.time),
    presentNpcNames,
    dangerLevel: Number.isFinite(dangerLevel) ? dangerLevel : undefined,
  });
  const block = formatPerceptionHints(hints);
  return block || undefined;
}

function mergeGameLoreIntoPrompt(prompt: string, worldBefore: string, worldAfter: string): string {
  const lore = [worldBefore, worldAfter].filter((part) => part.trim().length > 0).join("\n\n");
  return lore ? `${prompt}\n\n<lore>\n${lore}\n</lore>` : prompt;
}

async function buildGamePromptMessages(
  storage: StorageGateway,
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
  persona: GenerationPersonaContext | null,
  worldBefore: string,
  worldAfter: string,
): Promise<ChatMLMessage[]> {
  const meta = parseRecord(input.chat.metadata);
  const setup = parseRecord(meta.gameSetupConfig);
  const blueprint = parseRecord(meta.gameBlueprint);
  const gameCardMap = gameCardByName(meta);
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const gameNpcs = Array.isArray(meta.gameNpcs) ? (meta.gameNpcs as unknown as GameNpc[]) : [];
  const storedPartyIds = stringArray(meta.gamePartyCharacterIds);
  const partyIds = storedPartyIds.length ? storedPartyIds : stringArray(input.chat.characterIds);
  const partyNames: string[] = [];
  const partyCards: Array<{ name: string; card: string }> = [];

  for (const id of partyIds) {
    if (isPartyNpcId(id)) {
      const npc = gameNpcs.find((candidate) => buildPartyNpcId(readString(candidate.name)) === id);
      if (!npc?.name) continue;
      partyNames.push(npc.name);
      partyCards.push({ name: npc.name, card: npcPartyCardText(npc, gameCardMap.get(npc.name.toLowerCase())) });
      continue;
    }
    const character = await loadCharacterById(storage, id, characterById);
    if (!character) continue;
    partyNames.push(character.name);
    partyCards.push({
      name: character.name,
      card: characterCardText(character, gameCardMap.get(character.name.toLowerCase())),
    });
  }

  let gmCharacterCard: string | null = null;
  const gmCharacterId = readString(meta.gameGmCharacterId).trim();
  if (gmCharacterId) {
    const gmCharacter = await loadCharacterById(storage, gmCharacterId, characterById);
    if (gmCharacter) {
      gmCharacterCard = characterCardText(gmCharacter, gameCardMap.get(gmCharacter.name.toLowerCase()));
    }
  }

  const activeState = (readString(meta.gameActiveState, "exploration") || "exploration") as GameActiveState;
  const latestUser = latestUserContent(input.storedMessages, input.latestUserInput);
  const { gameTime, weatherContext } = gameTimeAndWeather(input.chat, meta);
  const hudWidgets = Array.isArray(meta.gameWidgetState)
    ? (meta.gameWidgetState as unknown as HudWidget[])
    : Array.isArray(blueprint.hudWidgets)
      ? (blueprint.hudWidgets as unknown as HudWidget[])
      : undefined;

  const gmCtx: GmPromptContext = {
    gameActiveState: activeState,
    storyArc: readString(meta.gameStoryArc).trim() || null,
    plotTwists: Array.isArray(meta.gamePlotTwists) ? (meta.gamePlotTwists as string[]) : null,
    campaignPlan: isRecord(blueprint.campaignPlan) ? (blueprint.campaignPlan as unknown as GameCampaignPlan) : null,
    map: isRecord(meta.gameMap) ? (meta.gameMap as unknown as GameMap) : null,
    npcs: gameNpcs,
    sessionSummaries: Array.isArray(meta.gamePreviousSessionSummaries)
      ? (meta.gamePreviousSessionSummaries as unknown as SessionSummary[])
      : [],
    sessionNumber: readNumber(meta.gameSessionNumber, 1) || 1,
    partyNames,
    partyCards,
    playerName: persona?.name || "Player",
    playerCard: personaCardText(persona, persona ? gameCardMap.get(persona.name.toLowerCase()) : undefined),
    gmCharacterCard,
    difficulty: readString(setup.difficulty, "normal") || "normal",
    genre: readString(setup.genre, "fantasy") || "fantasy",
    setting: readString(setup.setting, "original") || "original",
    tone: readString(setup.tone, "balanced") || "balanced",
    rating: readString(setup.rating) === "nsfw" ? "nsfw" : "sfw",
    gameTime,
    weatherContext,
    playerNotes: readString(meta.gamePlayerNotes).trim() || undefined,
    hudWidgets,
    hasSceneModel: !!(readString(meta.gameSceneConnectionId).trim() || readString(setup.sceneConnectionId).trim()),
    playerMoved: true,
    turnNumber: input.storedMessages.filter((message) => readString(message.role) === "user").length + 1,
    perceptionHints: buildGamePerceptionHints(input.chat, meta, persona),
    moraleContext:
      meta.gameMorale == null ? undefined : `Current party morale: ${readNumber(meta.gameMorale, 50)} / 100.`,
    playerInventory: normalizeGameInventory(meta.gameInventory),
    language: readString(setup.language).trim() || undefined,
  };

  let systemPrompt = buildGmSystemPrompt(gmCtx);
  const customGmPrompt = readString(meta.customGmPrompt).trim();
  if (customGmPrompt) systemPrompt = `${systemPrompt}\n\n${customGmPrompt}`;
  const extraPrompt = readString(meta.gameExtraPrompt)
    .trim()
    .replace(/<\/?special_instructions>/gi, "");
  if (extraPrompt) systemPrompt = `${systemPrompt}\n\n<special_instructions>\n${extraPrompt}\n</special_instructions>`;
  systemPrompt = mergeGameLoreIntoPrompt(systemPrompt, worldBefore, worldAfter);

  const formatReminder = buildGmFormatReminder({
    hasSceneModel: gmCtx.hasSceneModel,
    hudWidgets: gmCtx.hudWidgets,
    turnNumber: gmCtx.turnNumber,
    gameActiveState: gmCtx.gameActiveState,
    sessionNumber: gmCtx.sessionNumber,
    gameTime: gmCtx.gameTime,
    map: gmCtx.map,
    partyNames: gmCtx.partyNames,
    playerName: gmCtx.playerName,
    characterSprites: gmCtx.characterSprites,
    playerInventory: gmCtx.playerInventory,
    language: gmCtx.language,
    rating: gmCtx.rating,
    addressMode: gameAddressMode(latestUser),
    playerDiceRollSubmitted: /\[dice\b/i.test(latestUser),
  });

  return [
    { role: "system", content: systemPrompt, contextKind: "prompt" },
    { role: "user", content: formatReminder, contextKind: "prompt" },
  ];
}

function promptPresetCandidates(
  chat: JsonRecord,
  connection: JsonRecord,
  request: JsonRecord,
  defaultPromptId: string | null,
) {
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  const candidates = buildGenerationPromptPresetCandidates({
    chatMode: mode,
    chatPromptPresetId: chat.promptPresetId,
    connectionPromptPresetId: connection.promptPresetId,
    impersonate: request.impersonate === true,
    impersonatePromptPresetId: request.impersonatePresetId,
    requestPromptPresetId: readString(request.promptPresetId).trim() || readString(request.presetId).trim(),
  });
  if (mode !== "conversation" && defaultPromptId && !candidates.some((candidate) => candidate.id === defaultPromptId)) {
    return [...candidates, { id: defaultPromptId }];
  }
  return candidates;
}

async function loadDefaultPromptId(storage: StorageGateway): Promise<string | null> {
  const prompts = await storage.list<JsonRecord>("prompts");
  return (
    prompts
      .find((prompt) => boolish(prompt.isDefault ?? prompt.default, false))
      ?.id?.toString()
      .trim() || null
  );
}

async function loadPromptSections(storage: StorageGateway, presetId: string): Promise<PromptSectionRecord[]> {
  const sections = await storage.list<PromptSectionRecord>("prompt-sections", { filters: { presetId } });
  return sections.filter(isRecord).sort(bySortOrder);
}

async function loadPromptChoiceBlocks(storage: StorageGateway, presetId: string): Promise<PromptChoiceBlockRecord[]> {
  const blocks = await storage.list<PromptChoiceBlockRecord>("prompt-variables", { filters: { presetId } });
  return blocks.filter(isRecord).sort(bySortOrder);
}

async function loadPromptPresetRecord(storage: StorageGateway, presetId: string): Promise<JsonRecord | null> {
  const direct = await storage.get<JsonRecord>("prompts", presetId).catch(() => null);
  if (direct && isRecord(direct)) return direct;
  const prompts = await storage.list<JsonRecord>("prompts").catch(() => []);
  return prompts.find((prompt) => readString(prompt.id).trim() === presetId) ?? null;
}

async function loadPromptPresetBundle(
  storage: StorageGateway,
  presetId: string,
): Promise<{ preset: JsonRecord; sections: PromptSectionRecord[]; choiceBlocks: PromptChoiceBlockRecord[] } | null> {
  const full = await storage.promptFull?.<JsonRecord>(presetId).catch(() => null);
  if (full && isRecord(full.preset)) {
    const sections = Array.isArray(full.sections)
      ? full.sections.filter(isRecord).sort(bySortOrder)
      : await loadPromptSections(storage, presetId);
    const choiceBlocks = Array.isArray(full.choiceBlocks)
      ? full.choiceBlocks.filter(isRecord).sort(bySortOrder)
      : await loadPromptChoiceBlocks(storage, presetId);
    return {
      preset: full.preset,
      sections: sections as PromptSectionRecord[],
      choiceBlocks: choiceBlocks as PromptChoiceBlockRecord[],
    };
  }

  const preset = await loadPromptPresetRecord(storage, presetId);
  if (!preset) return null;
  const [sections, choiceBlocks] = await Promise.all([
    loadPromptSections(storage, presetId),
    loadPromptChoiceBlocks(storage, presetId),
  ]);
  return { preset, sections, choiceBlocks };
}

async function loadSelectedPromptPreset(
  storage: StorageGateway,
  input: {
    chat: JsonRecord;
    connection: JsonRecord;
    request: JsonRecord;
  },
): Promise<SelectedPromptPreset | null> {
  const defaultPromptId = await loadDefaultPromptId(storage);
  const candidates = promptPresetCandidates(input.chat, input.connection, input.request, defaultPromptId);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const presetId = candidate.id;
    const bundle = await loadPromptPresetBundle(storage, presetId);
    if (!bundle) continue;
    const { preset, sections, choiceBlocks } = bundle;
    const blocksByName = new Map(
      choiceBlocks
        .map((block) => [readString(block.variableName).trim(), block] as const)
        .filter(([name]) => name.length > 0),
    );
    const metadata = parseRecord(input.chat.metadata);
    const explicitVariables = stringRecord(input.chat.promptVariables ?? input.chat.variableValues);
    const chatPresetId = readString(input.chat.promptPresetId).trim();
    const chatChoices = chatPresetId === presetId ? (metadata.presetChoices ?? input.chat.presetChoices) : null;
    const mode = readString(input.chat.mode || input.chat.chatMode, "conversation");

    return {
      id: presetId,
      preset,
      sections,
      variables: {
        ...stringRecord(preset.variableValues),
        ...promptChoiceVariables(preset.defaultChoices, blocksByName),
        ...promptChoiceVariables(chatChoices, blocksByName),
        ...explicitVariables,
      },
      parameters: mode === "game" ? null : mergeStoredGenerationParameters(preset.parameters),
      wrapFormat: normalizeWrapFormat(preset.wrapFormat),
    };
  }
  return null;
}

function markerConfig(section: PromptSectionRecord): MarkerConfig | null {
  const raw = section.markerConfig;
  if (isRecord(raw) && typeof raw.type === "string") return raw as unknown as MarkerConfig;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = parseRecord(raw);
    if (typeof parsed.type === "string") return parsed as unknown as MarkerConfig;
  }
  const identifier = readString(section.identifier).toLowerCase();
  if (identifier.includes("chat") && identifier.includes("history")) return { type: "chat_history" };
  if (identifier.includes("dialogue")) return { type: "dialogue_examples" };
  if (identifier.includes("world") && identifier.includes("before")) return { type: "world_info_before" };
  if (identifier.includes("world") && identifier.includes("after")) return { type: "world_info_after" };
  if (identifier.includes("lore")) return { type: "lorebook" };
  if (identifier.includes("persona")) return { type: "persona" };
  if (identifier.includes("char")) return { type: "character" };
  return null;
}

function resolveLiveHostTimeZone(): string | undefined {
  try {
    return normalizeUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return undefined;
  }
}

function resolvePromptTimeZone(chat: JsonRecord, request: JsonRecord): string | undefined {
  // Preference order: persisted per-chat override → caller-supplied input →
  // live host resolution. The live fallback guarantees that every
  // startGeneration entry point (chat hook, game-turn service, background
  // autonomous chats, prompt-preview UI, future callers) resolves prompt-time
  // macros in the user's local zone even when the caller forgot to plumb
  // `userTimeZone` through the input contract. Engine code runs in the user's
  // Tauri webview, so `Intl` always reflects the user's OS.
  const persisted = normalizeUserTimeZone(parseRecord(chat.metadata).promptTimeZone);
  if (persisted) return persisted;
  const fromInput = normalizeUserTimeZone(request.userTimeZone);
  if (fromInput) return fromInput;
  return resolveLiveHostTimeZone();
}

function macroContext(input: {
  chat: JsonRecord;
  connection: JsonRecord;
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  latestUserInput: string;
  agentData?: Record<string, string>;
  variables?: Record<string, string>;
  request: JsonRecord;
}): MacroContext {
  const first = input.characters[0];
  return {
    user: input.persona?.name || "User",
    char: first?.name || "Character",
    characters: input.characters.map((character) => character.name),
    characterProfiles: input.characters.map((character) => ({
      name: character.name,
      description: character.description,
      personality: character.personality,
      backstory: character.backstory,
      appearance: character.appearance,
      scenario: character.scenario,
      example: character.mesExample,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
    })),
    variables: input.variables ?? stringRecord(input.chat.promptVariables ?? input.chat.variableValues),
    lastInput: input.latestUserInput,
    chatId: readString(input.chat.id),
    model: readString(input.connection.model),
    agentData: input.agentData,
    timeZone: resolvePromptTimeZone(input.chat, input.request),
    characterFields: first
      ? {
          description: first.description,
          personality: first.personality,
          backstory: first.backstory,
          appearance: first.appearance,
          scenario: first.scenario,
          example: first.mesExample,
          systemPrompt: first.systemPrompt,
          postHistoryInstructions: first.postHistoryInstructions,
        }
      : undefined,
    personaFields: input.persona
      ? {
          description: input.persona.description,
          personality: input.persona.personality,
          backstory: input.persona.backstory,
          appearance: input.persona.appearance,
          scenario: input.persona.scenario,
        }
      : undefined,
  };
}

const DEFAULT_CHARACTER_MARKER_FIELDS = [
  "description",
  "personality",
  "backstory",
  "appearance",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
] as const;

const CHARACTER_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  personality: "Personality",
  scenario: "Scenario",
  backstory: "Backstory",
  appearance: "Appearance",
  first_mes: "First Message",
  firstMes: "First Message",
  mes_example: "Example Dialogue",
  mesExample: "Example Dialogue",
  creator_notes: "Creator Notes",
  creatorNotes: "Creator Notes",
  system_prompt: "System Prompt",
  systemPrompt: "System Prompt",
  post_history_instructions: "Post History Instructions",
  postHistoryInstructions: "Post History Instructions",
};

function characterFieldValue(character: GenerationCharacterContext, fieldName: string): string {
  switch (fieldName) {
    case "name":
      return character.name;
    case "description":
      return character.description;
    case "personality":
      return character.personality ?? "";
    case "scenario":
      return character.scenario ?? "";
    case "backstory":
      return character.backstory ?? "";
    case "appearance":
      return character.appearance ?? "";
    case "first_mes":
    case "firstMes":
      return character.firstMes ?? "";
    case "mes_example":
    case "mesExample":
      return character.mesExample ?? "";
    case "creator_notes":
    case "creatorNotes":
      return character.creatorNotes ?? "";
    case "system_prompt":
    case "systemPrompt":
      return character.systemPrompt ?? "";
    case "post_history_instructions":
    case "postHistoryInstructions":
      return character.postHistoryInstructions ?? "";
    default:
      return "";
  }
}

function characterMarkerFields(marker: MarkerConfig | null): string[] {
  const fields = marker?.characterFields?.filter((fieldName) => typeof fieldName === "string" && fieldName.trim());
  return fields?.length ? fields : [...DEFAULT_CHARACTER_MARKER_FIELDS];
}

function renderNamedFields(entries: Array<[string, string | undefined]>, wrapFormat: WrapFormat, depth = 1): string {
  return entries
    .map(([label, value]) => {
      const trimmed = readString(value).trim();
      if (!trimmed) return "";
      return wrapFormat === "none" ? `${label}: ${trimmed}` : wrapContent(trimmed, label, wrapFormat, depth);
    })
    .filter(Boolean)
    .join("\n\n");
}

function renderCharacters(
  characters: GenerationCharacterContext[],
  wrapFormat: WrapFormat,
  marker: MarkerConfig | null,
): string {
  const fields = characterMarkerFields(marker);
  return characters
    .map((character) => {
      const content = renderNamedFields(
        [
          ["Name", character.name],
          ...fields.map((fieldName): [string, string] => [
            CHARACTER_FIELD_LABELS[fieldName] ?? fieldName,
            characterFieldValue(character, fieldName),
          ]),
        ],
        wrapFormat,
        2,
      );
      if (!content) return "";
      return wrapFormat === "none" ? content : wrapContent(content, character.name, wrapFormat, 1);
    })
    .filter(Boolean)
    .join("\n\n");
}

function renderDialogueExamples(characters: GenerationCharacterContext[]): string {
  return characters
    .map((character) => character.mesExample)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n\n");
}

function renderPersona(persona: GenerationPersonaContext | null, wrapFormat: WrapFormat): string {
  if (!persona) return "";
  return renderNamedFields(
    [
      ["Name", persona.name],
      ["Description", persona.description],
      ["Personality", persona.personality],
      ["Backstory", persona.backstory],
      ["Appearance", persona.appearance],
      ["Scenario", persona.scenario],
    ],
    wrapFormat,
    1,
  );
}

function renderJsonBlock(label: string, value: unknown): string {
  const record = parseRecord(value);
  if (Object.keys(record).length === 0) return "";
  return `${label}:\n${JSON.stringify(record, null, 2).slice(0, 4000)}`;
}

function fallbackSystemPrompt(
  input: PromptAssemblyInput,
  args: {
    characters: GenerationCharacterContext[];
    persona: GenerationPersonaContext | null;
    worldBefore: string;
    worldAfter: string;
    summary: string | null;
    wrapFormat: WrapFormat;
  },
): string {
  const mode = readString(input.chat.mode || input.chat.chatMode, "conversation");
  const meta = parseRecord(input.chat.metadata);
  const common = [
    renderCharacters(args.characters, args.wrapFormat, null),
    renderPersona(args.persona, args.wrapFormat),
    args.worldBefore,
    args.worldAfter,
    args.summary ? `Summary:\n${args.summary}` : "",
  ];

  if (mode === "game") {
    return [
      "You are Marinara's Game Master. Run the game as a structured campaign, not as a normal chat or roleplay scene.",
      "Narrate clear consequences, keep party members distinct, preserve game mechanics, and emit game tags when state, inventory, quests, encounters, music, or scene assets should change.",
      renderJsonBlock("Game setup", meta.gameSetupConfig),
      renderJsonBlock("Game state", input.chat.gameState ?? meta.gameState),
      ...common,
    ]
      .filter((part) => part.trim().length > 0)
      .join("\n\n");
  }

  if (mode === "roleplay" || meta.sceneStatus === "active") {
    return [
      "You are roleplaying in Marinara Engine. Stay in character, respect the scenario, and continue the scene naturally.",
      "Treat this as the roleplay path: focus on scene continuity, character action, dialogue, and immersive narration without using game-mode mechanics unless explicitly present in the chat.",
      ...common,
    ]
      .filter((part) => part.trim().length > 0)
      .join("\n\n");
  }

  return [
    "You are participating in a Marinara Engine conversation. Reply as the appropriate assistant character or narrator for this chat.",
    "Treat this as the conversation path: keep the exchange conversational, respect character cards and memory, and do not introduce roleplay HUD or game mechanics unless the user explicitly asks.",
    ...common,
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}

function shouldForceRoleplaySummaryIntoSystem(chat: JsonRecord): boolean {
  const meta = parseRecord(chat.metadata);
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  return mode === "roleplay" || meta.sceneStatus === "active";
}

function appendSummaryToSystemPrompt(
  messages: ChatMLMessage[],
  summary: string | null,
  wrapFormat: WrapFormat,
): boolean {
  const trimmed = summary?.trim();
  if (!trimmed) return false;

  const summaryBlock = wrapContent(trimmed, "chat_summary", wrapFormat);
  const firstHistoryIndex = messages.findIndex((message) => message.contextKind === "history");
  const promptEnd = firstHistoryIndex >= 0 ? firstHistoryIndex : messages.length;
  let systemIndex = -1;

  for (let index = promptEnd - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "system" || message.contextKind !== "prompt") continue;
    systemIndex = index;
    break;
  }

  if (systemIndex >= 0) {
    messages[systemIndex] = {
      ...messages[systemIndex]!,
      content: `${messages[systemIndex]!.content.trim()}\n\n${summaryBlock}`,
    };
    return true;
  }

  messages.unshift({
    role: "system",
    content: summaryBlock,
    contextKind: "prompt",
  });
  return true;
}

function buildRoleplayScenePromptBlock(chat: JsonRecord, wrapFormat: WrapFormat): string | null {
  const meta = parseRecord(chat.metadata);
  if (readString(chat.mode || chat.chatMode) !== "roleplay" && readString(meta.sceneStatus) !== "active") return null;
  const parts: string[] = [];

  const awareness: string[] = [];
  const relationship = readString(meta.sceneRelationshipHistory).trim();
  if (relationship) awareness.push(`Relationship history:\n${relationship}`);
  const context = readString(meta.sceneConversationContext).trim();
  if (context) awareness.push(`Conversation context before the scene:\n${context}`);
  const previous = readString(meta.lastRoleplaySceneSummary).trim();
  if (previous) awareness.push(`Previous scene continuity:\n${previous}`);
  if (awareness.length) parts.push(wrapContent(awareness.join("\n\n"), "awareness", wrapFormat));

  const scenario = readString(meta.sceneScenario).trim() || readString(meta.sceneDescription).trim();
  if (scenario) parts.push(wrapContent(scenario, "scene_scenario", wrapFormat));
  const instructions = readString(meta.sceneSystemPrompt).trim();
  if (instructions) parts.push(wrapContent(instructions, "scene_instructions", wrapFormat));

  return parts.length > 0 ? parts.join("\n\n") : null;
}

export function chatSummaryForGeneration(chat: JsonRecord): string | null {
  const meta = parseRecord(chat.metadata);
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  const includeSceneSummary = mode !== "conversation" || meta.crossChatAwareness !== false;
  const parts = [
    meta.conversationSummary,
    meta.summary,
    meta.daySummaries,
    meta.weekSummaries,
    includeSceneSummary ? meta.lastRoleplaySceneSummary : null,
  ]
    .map((value) =>
      typeof value === "string" ? value : isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : "",
    )
    .filter((value) => value.trim().length > 0);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

const MEMORY_EMBEDDING_DIMS = 256;
const DEFAULT_MEMORY_RECALL_BUDGET_TOKENS = 1024;
const MIN_MEMORY_RECALL_BUDGET_TOKENS = 256;
const MAX_MEMORY_RECALL_BUDGET_TOKENS = 2048;
const MAX_RECALLED_MEMORY_TOKENS = 384;
const MIN_RECALLED_MEMORY_TOKENS = 96;
const MEMORY_RECALL_CONTEXT_SHARE = 0.15;
const RECALL_TRUNCATION_MARKER = "\n...[recalled memory truncated]...\n";

function estimateTextTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed ? Math.max(1, Math.ceil(trimmed.length / 4)) : 0;
}

function lexicalMemoryEmbedding(text: string): number[] {
  const vector = Array.from({ length: MEMORY_EMBEDDING_DIMS }, () => 0);
  for (const match of text.toLowerCase().matchAll(/[a-z0-9]{2,}/g)) {
    let hash = 2166136261;
    for (let index = 0; index < match[0].length; index += 1) {
      hash ^= match[0].charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    vector[hash % MEMORY_EMBEDDING_DIMS] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    dot += left * right;
    magA += left * left;
    magB += right * right;
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator > 0 ? dot / denominator : 0;
}

function memoryVector(memory: JsonRecord, expectedDims?: number): number[] | null {
  if (!Array.isArray(memory.embedding)) return null;
  const vector = memory.embedding.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (expectedDims !== undefined) return vector.length === expectedDims ? vector : null;
  return vector.length > 0 ? vector : null;
}

function truncateRecalledMemory(content: string, tokenBudget: number): string {
  const maxChars = Math.max(32, tokenBudget * 4);
  if (content.length <= maxChars) return content;
  const availableChars = maxChars - RECALL_TRUNCATION_MARKER.length;
  if (availableChars <= 0) return content.slice(0, maxChars);
  const headChars = Math.max(16, Math.ceil(availableChars * 0.7));
  const tailChars = Math.max(16, availableChars - headChars);
  return `${content.slice(0, headChars).trimEnd()}${RECALL_TRUNCATION_MARKER}${content.slice(-tailChars).trimStart()}`;
}

function packRecalledMemories(recalled: Array<{ content: string }>, maxContext?: number) {
  const targetBudget = maxContext
    ? Math.floor(maxContext * MEMORY_RECALL_CONTEXT_SHARE)
    : DEFAULT_MEMORY_RECALL_BUDGET_TOKENS;
  const budgetTokens = Math.max(
    MIN_MEMORY_RECALL_BUDGET_TOKENS,
    Math.min(MAX_MEMORY_RECALL_BUDGET_TOKENS, targetBudget),
  );
  const lines: string[] = [];
  let estimatedTokens = 0;
  for (const memory of recalled) {
    const remainingTokens = budgetTokens - estimatedTokens;
    if (remainingTokens < MIN_RECALLED_MEMORY_TOKENS) break;
    const packed = truncateRecalledMemory(memory.content, Math.min(MAX_RECALLED_MEMORY_TOKENS, remainingTokens));
    const packedTokens = estimateTextTokens(packed);
    if (packedTokens <= 0 || packedTokens > remainingTokens) break;
    lines.push(packed);
    estimatedTokens += packedTokens;
  }
  return { lines, estimatedTokens, budgetTokens };
}

function memoryRecallEnabled(chat: JsonRecord): boolean {
  const meta = parseRecord(chat.metadata);
  if (typeof meta.enableMemoryRecall === "boolean") return meta.enableMemoryRecall;
  const mode = readString(chat.mode || chat.chatMode);
  return mode === "conversation" || meta.sceneStatus === "active";
}

async function buildMemoryRecallBlock(
  storage: StorageGateway,
  chat: JsonRecord,
  latestUserInput: string,
  maxContext?: number,
  embeddingSource?: { embed(texts: string[]): Promise<number[][] | null> } | null,
): Promise<string | null> {
  if (!memoryRecallEnabled(chat) || !latestUserInput.trim()) return null;
  const chatId = readString(chat.id).trim();
  if (!chatId) return null;
  let memories: JsonRecord[] = [];
  try {
    const rows = await storage.listChatMemories<unknown>(chatId);
    memories = Array.isArray(rows) ? rows.filter(isRecord) : [];
  } catch {
    memories = Array.isArray(chat.memories) ? chat.memories.filter(isRecord) : [];
  }
  if (memories.length === 0) return null;

  let semanticQueryVector: number[] | null = null;
  try {
    const sourceEmbedding = embeddingSource ? await embeddingSource.embed([latestUserInput]) : null;
    const vector = sourceEmbedding?.[0]?.filter((value): value is number => Number.isFinite(value));
    semanticQueryVector = vector?.length ? vector : null;
  } catch {
    semanticQueryVector = null;
  }
  const queryVector = lexicalMemoryEmbedding(latestUserInput);
  const queryTokens = new Set(latestUserInput.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
  const recalled = memories
    .map((memory) => {
      const content = readString(memory.content).trim();
      if (!content) return null;
      const providerVector = semanticQueryVector ? memoryVector(memory, semanticQueryVector.length) : null;
      const vector = providerVector ?? memoryVector(memory, MEMORY_EMBEDDING_DIMS) ?? lexicalMemoryEmbedding(content);
      const baseQueryVector = providerVector && semanticQueryVector ? semanticQueryVector : queryVector;
      const haystack = content.toLowerCase();
      const lexicalScore = Array.from(queryTokens).reduce(
        (score, token) => score + (haystack.includes(token) ? 1 : 0),
        0,
      );
      const similarity = cosineSimilarity(baseQueryVector, vector) + Math.min(0.2, lexicalScore * 0.025);
      return { content, similarity };
    })
    .filter((memory): memory is { content: string; similarity: number } => !!memory && memory.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
  if (recalled.length === 0) return null;

  const packed = packRecalledMemories(recalled, maxContext);
  if (packed.lines.length === 0) return null;
  return [
    "<memories>",
    "The following are recalled fragments from earlier in this chat. Use them to maintain continuity, remember past events, and stay in character. Do not explicitly reference memory recall unless it is natural.",
    ...packed.lines.map((line, index) => `--- Memory ${index + 1} ---\n${line}`),
    "</memories>",
  ].join("\n");
}

function connectedNoteTargetsChat(note: JsonRecord, chatId: string): boolean {
  const targetChatId = readString(note.targetChatId).trim();
  return !targetChatId || targetChatId === chatId;
}

function connectedPromptLines(notes: JsonRecord[], type: "note" | "influence", chatId: string): string[] {
  return notes
    .filter((note) => readString(note.type) === type && connectedNoteTargetsChat(note, chatId))
    .filter((note) => type !== "influence" || !boolish(note.consumed, false))
    .map((note) => stripConversationPromptTimestamps(readString(note.content).trim()))
    .filter((content) => content.length > 0)
    .map((content) => `- ${content}`);
}

function buildConnectedConversationBlocks(chat: JsonRecord): ChatMLMessage[] {
  const chatId = readString(chat.id).trim();
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  const meta = parseRecord(chat.metadata);
  if (!chatId || (mode !== "roleplay" && mode !== "game") || !readString(chat.connectedChatId).trim()) return [];
  if (readString(meta.sceneStatus) === "active") return [];
  const notes = parseArray(chat.notes).filter(isRecord);
  if (notes.length === 0) return [];

  const blocks: ChatMLMessage[] = [];
  const influenceLines = connectedPromptLines(notes, "influence", chatId);
  if (influenceLines.length > 0) {
    blocks.push({
      role: "system",
      contextKind: "prompt",
      content: [
        "<ooc_influences>",
        mode === "game"
          ? "The following out-of-character notes come from a connected conversation. They represent things the players discussed or decided outside the game. Use them to steer the next scene, NPC reactions, objectives, or world state when appropriate. Do not mention them explicitly as OOC in the narrative."
          : "The following out-of-character notes come from a connected conversation. They represent things the players discussed or decided outside of the roleplay. Weave them naturally into the story. Do not mention them explicitly as OOC in the narrative.",
        ...influenceLines,
        "</ooc_influences>",
      ].join("\n"),
    });
  }

  const noteLines = connectedPromptLines(notes, "note", chatId);
  if (noteLines.length > 0) {
    blocks.push({
      role: "system",
      contextKind: "prompt",
      content: [
        "<conversation_notes>",
        mode === "game"
          ? "Durable notes from a connected conversation. These persist across every turn until the user clears them and represent ongoing truth: character knowledge, world facts, and recurring dynamics. Use them to inform NPC behavior, world state, and scene framing without calling them notes in the narrative."
          : "Durable notes from a connected conversation. These persist across every turn until the user clears them and represent things the character has been told to remember about themselves, the user, or the world. Use them to inform behavior, knowledge, and reactions naturally without calling them notes in the narrative.",
        ...noteLines,
        "</conversation_notes>",
      ].join("\n"),
    });
  }
  return blocks;
}

function insertBeforeLastUser(messages: ChatMLMessage[], blocks: ChatMLMessage[]): void {
  if (blocks.length === 0) return;
  const insertAt = messages.map((message) => message.role).lastIndexOf("user");
  messages.splice(insertAt >= 0 ? insertAt : messages.length, 0, ...blocks);
}

function normalizeRole(value: unknown): "system" | "user" | "assistant" {
  return value === "system" || value === "assistant" ? value : "user";
}

function messageStoredReasoning(message: JsonRecord): string {
  const extra = parseRecord(message.extra);
  const thinking = readString(extra.thinking ?? extra.reasoning ?? extra.reasoning_content).trim();
  return thinking;
}

function historyMessageContent(message: JsonRecord, includePastReasoning: boolean): string {
  const content = collapseExcessBlankLines(readString(message.content).trim());
  if (!includePastReasoning || readString(message.role) !== "assistant") return content;
  const thinking = messageStoredReasoning(message);
  if (!thinking) return content;
  return `${content}\n\n<provider_reasoning>\n${thinking}\n</provider_reasoning>`;
}

function historyMessages(storedMessages: JsonRecord[], limit: number, includePastReasoning = false): ChatMLMessage[] {
  return storedMessages
    .filter((message) => !hiddenFromAi(message))
    .slice(-limit)
    .map((message) => ({
      role: normalizeRole(message.role),
      content: historyMessageContent(message, includePastReasoning),
      contextKind: "history" as const,
      characterId: readString(message.characterId).trim() || undefined,
      name: readString(message.name).trim() || undefined,
    }))
    .filter((message) => message.content.length > 0);
}

function shouldMergeSameRolePromptMessage(
  previous: ChatMLMessage | undefined,
  _message: ChatMLMessage,
  effectiveRole: "user" | "assistant",
): previous is ChatMLMessage {
  if (!previous || previous.role !== effectiveRole) return false;
  return true;
}

function mergeIntoPreviousPromptMessage(previous: ChatMLMessage, message: ChatMLMessage): void {
  previous.content += "\n\n" + message.content;
  previous.content = collapseExcessBlankLines(previous.content);
  if ((previous.displayName ?? null) !== (message.displayName ?? null)) {
    delete previous.displayName;
  }
  if (previous.contextKind !== message.contextKind) {
    delete previous.contextKind;
  }
  if ((previous.characterId ?? null) !== (message.characterId ?? null)) {
    delete previous.characterId;
    delete previous.name;
  }
  if (message.images?.length) {
    previous.images = [...(previous.images ?? []), ...message.images];
  }
  if (previous.role === "assistant" && message.providerMetadata) {
    previous.providerMetadata = message.providerMetadata;
  }
}

function promptMessageWithRole(message: ChatMLMessage, role: "user" | "assistant"): ChatMLMessage {
  const next = { ...message, role };
  if (role !== "assistant") {
    delete next.providerMetadata;
  }
  return next;
}

function scopedIndividualGroupTarget(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): string | null {
  const chatMode = readString(input.chat.mode || input.chat.chatMode);
  if (chatMode !== "roleplay" || characters.length <= 1 || input.request.impersonate === true) return null;
  const metadata = parseRecord(input.chat.metadata);
  if (readString(metadata.groupChatMode, "merged") !== "individual") return null;
  const requestedCharacterId = readString(input.request.forCharacterId).trim();
  if (!requestedCharacterId) return null;
  return characters.some((character) => character.id === requestedCharacterId) ? requestedCharacterId : null;
}

function promptCharactersForGeneration(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): GenerationCharacterContext[] {
  const targetId = scopedIndividualGroupTarget(input, characters);
  if (!targetId) return characters;
  return characters.filter((character) => character.id === targetId);
}

function isIndividualGroupHistoryMessage(message: ChatMLMessage): boolean {
  return (
    message.contextKind === "history" ||
    (message.contextKind === undefined && message.role !== "system" && message.characterId != null)
  );
}

function scopeIndividualGroupHistoryRoles(messages: ChatMLMessage[], targetCharacterId: string): ChatMLMessage[] {
  return messages.map((message) => {
    if (!isIndividualGroupHistoryMessage(message)) return message;
    let next = { ...message };
    if (next.characterId) {
      next.role = next.characterId === targetCharacterId ? "assistant" : "user";
    } else if (next.role === "assistant") {
      next.role = "user";
    }
    if (next.role !== "assistant" && next.providerMetadata) {
      const withoutAssistantMetadata = { ...next };
      delete withoutAssistantMetadata.providerMetadata;
      next = withoutAssistantMetadata;
    }
    return next;
  });
}

function enforceStrictRoles(messages: ChatMLMessage[]): ChatMLMessage[] {
  if (messages.length === 0) return messages;
  const result: ChatMLMessage[] = [];
  let index = 0;
  const systemParts: string[] = [];
  while (index < messages.length && messages[index]!.role === "system") {
    if (messages[index]!.contextKind === "history") {
      break;
    }
    systemParts.push(messages[index]!.content);
    index += 1;
  }
  if (systemParts.length > 0) {
    result.push({
      role: "system",
      content: systemParts.join("\n\n"),
      contextKind: "prompt",
      ...(index === 1 && messages[0]?.displayName ? { displayName: messages[0].displayName } : {}),
    });
  }

  let expectedRole: "user" | "assistant" = "user";
  for (; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (message.role === "system") {
      result.push(message);
      expectedRole = "user";
      continue;
    }

    const effectiveRole = message.role;
    if (effectiveRole === expectedRole) {
      result.push(promptMessageWithRole(message, effectiveRole));
      expectedRole = effectiveRole === "user" ? "assistant" : "user";
      continue;
    }

    const previous = result[result.length - 1];
    if (shouldMergeSameRolePromptMessage(previous, message, effectiveRole)) {
      mergeIntoPreviousPromptMessage(previous, message);
      continue;
    }

    result.push(promptMessageWithRole(message, expectedRole));
    expectedRole = expectedRole === "user" ? "assistant" : "user";
  }

  return result;
}

function collapseToSingleUserMessage(messages: ChatMLMessage[]): ChatMLMessage[] {
  const content = messages
    .map((message) =>
      message.role === "user" ? message.content : `[${message.role.toUpperCase()}]\n${message.content}`,
    )
    .filter((content) => content.trim())
    .join("\n\n");
  return content ? [{ role: "user", content, contextKind: "prompt" }] : [];
}

function previewMessagesForPrompt(messages: ChatMLMessage[]): ChatMLMessage[] {
  return messages.map((message) => ({ ...message }));
}

function authorNotesDepthEntry(chat: JsonRecord): { content: string; role: "system"; depth: number } | null {
  const meta = parseRecord(chat.metadata);
  const content = cleanPromptText(readString(meta.authorNotes).trim());
  if (!content) return null;
  const depth = Math.max(0, readNumber(meta.authorNotesDepth, 4));
  return { content, role: "system", depth };
}

export function normalizeLorebookEntry(entry: JsonRecord): LorebookEntry {
  return {
    id: readString(entry.id),
    lorebookId: readString(entry.lorebookId),
    name: readString(entry.name) || "Entry",
    content: readString(entry.content),
    description: readString(entry.description),
    keys: stringArray(entry.keys),
    secondaryKeys: stringArray(entry.secondaryKeys),
    selective: boolish(entry.selective, false),
    selectiveLogic: readString(entry.selectiveLogic, "and") as LorebookEntry["selectiveLogic"],
    constant: boolish(entry.constant, false),
    enabled: boolish(entry.enabled, true),
    position: readNumber(entry.position, 0),
    role: normalizeRole(entry.role) as LorebookEntry["role"],
    depth: readNumber(entry.depth, 0),
    order: readNumber(entry.order ?? entry.sortOrder, 0),
    probability: entry.probability == null ? null : readNumber(entry.probability, 100),
    useRegex: boolish(entry.useRegex, false),
    matchWholeWords: boolish(entry.matchWholeWords, false),
    caseSensitive: boolish(entry.caseSensitive, false),
    ephemeral: entry.ephemeral == null ? null : readNumber(entry.ephemeral, 0),
    group: readString(entry.group),
    groupWeight: entry.groupWeight == null ? null : readNumber(entry.groupWeight, 100),
    folderId: readString(entry.folderId) || null,
    locked: boolish(entry.locked, false),
    preventRecursion: boolish(entry.preventRecursion, false),
    tag: readString(entry.tag),
    relationships: stringRecord(entry.relationships),
    dynamicState: parseRecord(entry.dynamicState),
    scanDepth: entry.scanDepth == null ? null : readNumber(entry.scanDepth, 0),
    sticky: entry.sticky == null ? null : readNumber(entry.sticky, 0),
    cooldown: entry.cooldown == null ? null : readNumber(entry.cooldown, 0),
    delay: entry.delay == null ? null : readNumber(entry.delay, 0),
    activationConditions: Array.isArray(entry.activationConditions) ? entry.activationConditions : [],
    schedule: isRecord(entry.schedule) ? (entry.schedule as unknown as LorebookEntry["schedule"]) : null,
    excludeFromVectorization: boolish(entry.excludeFromVectorization, false),
    embedding: Array.isArray(entry.embedding)
      ? entry.embedding.filter((item): item is number => typeof item === "number")
      : null,
    additionalMatchingSources: stringArray(
      entry.additionalMatchingSources,
    ) as LorebookEntry["additionalMatchingSources"],
    characterFilterMode: readString(entry.characterFilterMode, "any") as LorebookEntry["characterFilterMode"],
    characterFilterIds: stringArray(entry.characterFilterIds),
    characterTagFilterMode: readString(entry.characterTagFilterMode, "any") as LorebookEntry["characterTagFilterMode"],
    characterTagFilters: stringArray(entry.characterTagFilters),
    generationTriggerFilterMode: readString(
      entry.generationTriggerFilterMode,
      "any",
    ) as LorebookEntry["generationTriggerFilterMode"],
    generationTriggerFilters: stringArray(entry.generationTriggerFilters),
    createdAt: readString(entry.createdAt),
    updatedAt: readString(entry.updatedAt),
  };
}

function lorebookAppliesToContext(
  lorebook: JsonRecord,
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  persona: GenerationPersonaContext | null,
): boolean {
  if (!boolish(lorebook.enabled, true)) return false;
  const meta = parseRecord(chat.metadata);
  const scopeExclusions = resolveGameLorebookScopeExclusions(readString(chat.mode || chat.chatMode), meta);
  const lorebookId = readString(lorebook.id);
  if (scopeExclusions.excludedLorebookIds.includes(lorebookId)) return false;
  if (scopeExclusions.excludedSourceAgentIds.includes(readString(lorebook.sourceAgentId))) return false;
  if (boolish(lorebook.isGlobal ?? lorebook.global, false)) return true;
  const activeIds = new Set(characters.map((character) => character.id));
  const lorebookCharacterIds = stringArray(lorebook.characterIds);
  if (lorebookCharacterIds.some((id) => activeIds.has(id)) || activeIds.has(readString(lorebook.characterId))) {
    return true;
  }
  const personaId = readString(chat.personaId);
  if (persona && personaId) {
    const personaIds = stringArray(lorebook.personaIds);
    if (personaIds.includes(personaId) || readString(lorebook.personaId) === personaId) return true;
  }
  const chatScopedId = readString(lorebook.chatId).trim();
  if (chatScopedId && chatScopedId === readString(chat.id).trim()) return true;
  return stringArray(meta.activeLorebookIds ?? chat.activeLorebookIds).includes(lorebookId);
}

function joinMatchingSourceParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

function buildAdditionalMatchingSourceText(
  characters: GenerationCharacterContext[],
  persona: GenerationPersonaContext | null,
): Partial<Record<LorebookMatchingSource, string>> {
  return {
    character_name: joinMatchingSourceParts(characters.map((character) => character.name)),
    character_description: joinMatchingSourceParts(characters.map((character) => character.description)),
    character_personality: joinMatchingSourceParts(characters.map((character) => character.personality)),
    character_scenario: joinMatchingSourceParts(characters.map((character) => character.scenario)),
    character_tags: joinMatchingSourceParts(characters.flatMap((character) => character.tags)),
    persona_description: persona?.description ?? "",
    persona_tags: joinMatchingSourceParts(persona?.tags ?? []),
  };
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(readNumber(value, fallback)));
}

const MAX_LOREBOOK_RECURSION_DEPTH = 10;

interface LoadedLorebookBudgetSkippedEntry {
  activatedEntry: ActivatedEntry;
  lorebookName: string;
  lorebookBudget: number;
  lorebookUsedTokens: number;
  estimatedTokens: number;
}

interface ScannedLorebookEntries {
  activatedEntries: ActivatedEntry[];
  budgetSkippedEntries: LoadedLorebookBudgetSkippedEntry[];
}

interface LoadedActivatedLore {
  activatedEntries: ActivatedEntry[];
  budgetSkippedEntries: LoadedLorebookBudgetSkippedEntry[];
  lorebookNamesById: Map<string, string>;
}

function resolveLorebookTokenBudget(chat: JsonRecord, request: JsonRecord): number {
  const meta = parseRecord(chat.metadata);
  return nonNegativeInteger(
    request.lorebookTokenBudget,
    readNumber(meta.lorebookTokenBudget, LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET),
  );
}

function resolveLorebookRecursionDepth(lorebook: JsonRecord): number {
  return Math.min(MAX_LOREBOOK_RECURSION_DEPTH, Math.max(1, nonNegativeInteger(lorebook.maxRecursionDepth, 3)));
}

async function loadLorebookEntriesForActivation(
  storage: StorageGateway,
  lorebook: JsonRecord,
): Promise<LorebookEntry[]> {
  const id = readString(lorebook.id);
  if (!id) return [];
  const [rows, folders] = await Promise.all([
    storage.listLorebookEntries<JsonRecord>(id),
    storage.list<JsonRecord>("lorebook-folders", { filters: { lorebookId: id } }),
  ]);
  const disabledFolderIds = new Set(
    folders
      .filter((folder) => !boolish(folder.enabled, true))
      .map((folder) => readString(folder.id))
      .filter(Boolean),
  );
  const defaultScanDepth = nonNegativeInteger(lorebook.scanDepth, 0);
  const excludeFromVectorization = boolish(lorebook.excludeFromVectorization, false);
  return rows
    .map((row) => normalizeLorebookEntry(excludeFromVectorization ? { ...row, excludeFromVectorization: true } : row))
    .map((entry) => ({
      ...entry,
      scanDepth: entry.scanDepth == null ? defaultScanDepth : entry.scanDepth,
    }))
    .filter((entry) => entry.enabled && entry.content.trim())
    .filter((entry) => !entry.folderId || !disabledFolderIds.has(entry.folderId));
}

function scanLorebookEntries(
  messages: ScanMessage[],
  entries: LorebookEntry[],
  lorebook: JsonRecord,
  options: ScanOptions,
): ScannedLorebookEntries {
  const activated = boolish(lorebook.recursiveScanning, false)
    ? recursiveScan(messages, entries, options, resolveLorebookRecursionDepth(lorebook))
    : scanForActivatedEntries(messages, entries, options);
  const lorebookId = readString(lorebook.id);
  const lorebookName = readString(lorebook.name, lorebookId || "Lorebook");
  const lorebookBudget = nonNegativeInteger(lorebook.tokenBudget, 0);
  const budgeted = applyTokenBudgetWithSkipped(activated, lorebookBudget);
  return {
    activatedEntries: budgeted.includedEntries,
    budgetSkippedEntries: budgeted.skippedEntries.map((skipped) => ({
      activatedEntry: skipped.activatedEntry,
      lorebookName,
      lorebookBudget,
      lorebookUsedTokens: skipped.usedTokensBefore,
      estimatedTokens: skipped.estimatedTokens,
    })),
  };
}

async function loadActivatedLore(
  storage: StorageGateway,
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  persona: GenerationPersonaContext | null,
  storedMessages: JsonRecord[],
): Promise<LoadedActivatedLore> {
  const lorebooks = (await storage.list<JsonRecord>("lorebooks")).filter((book) =>
    lorebookAppliesToContext(book, chat, characters, persona),
  );
  const activeCharacterIds = characters.map((character) => character.id);
  const activeCharacterTags = characters.flatMap((character) => character.tags);
  const meta = parseRecord(chat.metadata);
  const gameState = parseRecord(chat.gameState ?? meta.gameState);
  const messages = storedMessages
    .filter((message) => !hiddenFromAi(message))
    .map((message) => ({
      role: readString(message.role, "user"),
      content: readString(message.content),
    }));
  const generationTriggers = ["chat", readString(chat.mode || chat.chatMode)].filter(Boolean);
  const options: ScanOptions = {
    activeCharacterIds,
    activeCharacterTags,
    generationTriggers,
    gameState,
    additionalMatchingSourceText: buildAdditionalMatchingSourceText(characters, persona),
  };
  const lorebookNamesById = new Map(
    lorebooks.map((book) => {
      const id = readString(book.id);
      return [id, readString(book.name, id || "Lorebook")] as const;
    }),
  );
  const scanned = await Promise.all(
    lorebooks.map(async (book) =>
      scanLorebookEntries(messages, await loadLorebookEntriesForActivation(storage, book), book, options),
    ),
  );
  return {
    activatedEntries: scanned
      .flatMap((result) => result.activatedEntries)
      .sort((a, b) => a.injectionOrder - b.injectionOrder),
    budgetSkippedEntries: scanned.flatMap((result) => result.budgetSkippedEntries),
    lorebookNamesById,
  };
}

function loreForEvent(entry: ActivatedEntry) {
  return {
    id: entry.entry.id,
    lorebookId: entry.entry.lorebookId,
    name: entry.entry.name,
    content: entry.entry.content,
    tag: entry.matchedKeys.join(", "),
    matchedKeys: entry.matchedKeys,
    order: entry.entry.order,
    constant: entry.entry.constant,
  };
}

function budgetSkippedLoreForEvent(
  skipped: BudgetSkippedActivatedEntry,
  lorebookNamesById: Map<string, string>,
  chatBudget: number,
): BudgetSkippedLorebookEntry {
  const entry = skipped.activatedEntry.entry;
  return {
    id: entry.id,
    name: entry.name,
    lorebookId: entry.lorebookId,
    lorebookName: lorebookNamesById.get(entry.lorebookId) ?? entry.lorebookId,
    matchedKeys: skipped.activatedEntry.matchedKeys,
    estimatedTokens: skipped.estimatedTokens,
    lorebookBudget: 0,
    lorebookUsedTokens: 0,
    chatBudget,
    chatUsedTokens: skipped.usedTokensBefore,
    blockedBy: "chat",
  };
}

function lorebookBudgetSkippedLoreForEvent(
  skipped: LoadedLorebookBudgetSkippedEntry,
  chatBudget: number,
): BudgetSkippedLorebookEntry {
  const entry = skipped.activatedEntry.entry;
  return {
    id: entry.id,
    name: entry.name,
    lorebookId: entry.lorebookId,
    lorebookName: skipped.lorebookName,
    matchedKeys: skipped.activatedEntry.matchedKeys,
    estimatedTokens: skipped.estimatedTokens,
    lorebookBudget: skipped.lorebookBudget,
    lorebookUsedTokens: skipped.lorebookUsedTokens,
    chatBudget,
    chatUsedTokens: 0,
    blockedBy: "lorebook",
  };
}

function sectionContent(args: {
  section: PromptSectionRecord;
  marker: MarkerConfig | null;
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  worldBefore: string;
  worldAfter: string;
  summary: string | null;
  agentData: Record<string, string>;
  wrapFormat: WrapFormat;
}) {
  switch (args.marker?.type) {
    case "character":
      return renderCharacters(args.characters, args.wrapFormat, args.marker);
    case "persona":
      return renderPersona(args.persona, args.wrapFormat);
    case "dialogue_examples":
      return renderDialogueExamples(args.characters);
    case "chat_summary":
      return args.summary ?? "";
    case "world_info_before":
      return args.worldBefore;
    case "world_info_after":
      return args.worldAfter;
    case "lorebook":
      return [args.worldBefore, args.worldAfter].filter(Boolean).join("\n\n");
    case "agent_data":
      return args.marker.agentType
        ? (args.agentData[args.marker.agentType] ?? "")
        : Object.entries(args.agentData)
            .map(([type, text]) => `${type}: ${text}`)
            .join("\n\n");
    case "chat_history":
      return "";
    default:
      return readString(args.section.content);
  }
}

export async function assembleGenerationPrompt(
  storage: StorageGateway,
  input: PromptAssemblyInput,
): Promise<PromptAssemblyResult> {
  const characters = await loadCharacters(storage, input.chat);
  const persona = await loadPersona(storage, input.chat);
  const loadedLore = await loadActivatedLore(storage, input.chat, characters, persona, input.storedMessages);
  const lorebookTokenBudget = resolveLorebookTokenBudget(input.chat, input.request);
  const processedLore = processActivatedEntries(loadedLore.activatedEntries, lorebookTokenBudget);
  const budgetSkippedLorebookEntries = [
    ...loadedLore.budgetSkippedEntries.map((entry) => lorebookBudgetSkippedLoreForEvent(entry, lorebookTokenBudget)),
    ...processedLore.skippedEntries.map((entry) =>
      budgetSkippedLoreForEvent(entry, loadedLore.lorebookNamesById, lorebookTokenBudget),
    ),
  ];
  const summary = chatSummaryForGeneration(input.chat);
  const memoryRecallBlock = await buildMemoryRecallBlock(
    storage,
    input.chat,
    input.latestUserInput,
    readNumber(input.connection.maxContext, 0) || undefined,
    input.embeddingSource,
  );
  const selectedPreset = await loadSelectedPromptPreset(storage, {
    chat: input.chat,
    connection: input.connection,
    request: input.request,
  });
  const presetId = selectedPreset?.id ?? null;
  const promptParameters = mergeStoredGenerationParameters(
    ...generationParameterSources(input.connection, input.request, input.chat, selectedPreset?.parameters),
  );
  const wrapFormat =
    selectedPreset?.wrapFormat ??
    normalizeWrapFormat(input.chat.wrapFormat) ??
    normalizeWrapFormat(input.connection.wrapFormat) ??
    "xml";
  const promptCharacters = promptCharactersForGeneration(input, characters);
  const chatMeta = parseRecord(input.chat.metadata);
  const metadataHistoryLimit = readNumber(chatMeta.contextMessageLimit, 0);
  const requestedHistoryLimit = readNumber(input.request.historyLimit, metadataHistoryLimit || 300);
  const historyLimit = Math.max(1, Math.min(300, metadataHistoryLimit || requestedHistoryLimit || 300));
  const history = historyMessages(input.storedMessages, historyLimit, chatMeta.excludePastReasoning === false);
  const macros = macroContext({
    chat: input.chat,
    connection: input.connection,
    characters: promptCharacters,
    persona,
    latestUserInput: input.latestUserInput,
    agentData: input.agentData,
    variables: selectedPreset?.variables,
    request: input.request,
  });
  const agentData = input.agentData ?? {};
  let messages: ChatMLMessage[] = [];
  let insertedHistory = false;
  let insertedSummary = false;
  let usedFallbackSystemPrompt = false;

  if (selectedPreset) {
    for (const section of selectedPreset.sections) {
      if (!boolish(section.enabled, true)) continue;
      const marker = markerConfig(section);
      if (marker?.type === "chat_history") {
        messages.push(...history);
        insertedHistory = true;
        continue;
      }
      const rawContent = sectionContent({
        section,
        marker,
        characters: promptCharacters,
        persona,
        worldBefore: processedLore.worldInfoBefore,
        worldAfter: processedLore.worldInfoAfter,
        summary,
        agentData,
        wrapFormat,
      });
      const resolved = cleanPromptText(resolveMacros(rawContent, macros));
      if (!resolved.trim()) continue;
      if (marker?.type === "chat_summary" && summary?.trim()) insertedSummary = true;
      const name = readString(section.name) || readString(section.identifier) || marker?.type || "Prompt";
      messages.push({
        role: normalizeRole(section.role),
        content: wrapContent(resolved, name, wrapFormat),
        contextKind: "prompt",
        displayName: name,
      });
    }
  }

  if (messages.length === 0) {
    usedFallbackSystemPrompt = true;
    messages.push({
      role: "system",
      content: fallbackSystemPrompt(input, {
        characters: promptCharacters,
        persona,
        worldBefore: processedLore.worldInfoBefore,
        worldAfter: processedLore.worldInfoAfter,
        summary,
        wrapFormat,
      }),
      contextKind: "prompt",
    });
  }

  if (!usedFallbackSystemPrompt && !insertedSummary && shouldForceRoleplaySummaryIntoSystem(input.chat)) {
    appendSummaryToSystemPrompt(messages, summary, wrapFormat);
  }

  if (!insertedHistory) {
    messages.push(...history);
  }

  const chatMode = readString(input.chat.mode || input.chat.chatMode, "conversation");
  if (chatMode === "game") {
    const [gameSystem, gameReminder] = await buildGamePromptMessages(
      storage,
      input,
      characters,
      persona,
      processedLore.worldInfoBefore,
      processedLore.worldInfoAfter,
    );
    const firstSystemIndex = messages.findIndex((message) => message.role === "system");
    if (firstSystemIndex >= 0) {
      messages[firstSystemIndex] = gameSystem!;
    } else {
      messages.unshift(gameSystem!);
    }
    messages.push(gameReminder!);
  } else {
    const sceneBlock = buildRoleplayScenePromptBlock(input.chat, wrapFormat);
    if (sceneBlock) {
      const firstSystemIndex = messages.findIndex((message) => message.role === "system");
      messages.splice(firstSystemIndex >= 0 ? firstSystemIndex + 1 : 0, 0, {
        role: "system",
        content: sceneBlock,
        contextKind: "prompt",
      });
    }
  }

  if (memoryRecallBlock) {
    const insertAt = messages.findIndex((message) => message.role === "user" || message.role === "assistant");
    messages.splice(insertAt >= 0 ? insertAt : messages.length, 0, {
      role: "system",
      content: memoryRecallBlock,
      contextKind: "prompt",
    });
  }

  insertBeforeLastUser(messages, buildConnectedConversationBlocks(input.chat));

  const authorNotesEntry = authorNotesDepthEntry(input.chat);
  messages = injectAtDepth(
    messages,
    authorNotesEntry ? [...processedLore.depthEntries, authorNotesEntry] : processedLore.depthEntries,
  );
  const regexScripts = await storage.list<JsonRecord>("regex-scripts");
  applyRegexScriptsToPromptMessages(messages, regexScripts, {
    resolveMacros: (value) => resolveMacros(value, macros, { trimResult: false }),
  });
  messages = messages
    .map((message) => ({
      ...message,
      content: collapseExcessBlankLines(stripPromptComments(message.content)).trim(),
    }))
    .filter((message) => message.content.length > 0);
  const individualGroupTarget = scopedIndividualGroupTarget(input, characters);
  if (individualGroupTarget) {
    messages = scopeIndividualGroupHistoryRoles(messages, individualGroupTarget);
  }
  const previewMessages = previewMessagesForPrompt(messages);
  const strictRoleFormatting = boolish(promptParameters?.strictRoleFormatting, true) && chatMode === "roleplay";
  messages = strictRoleFormatting ? enforceStrictRoles(messages) : mergeAdjacentMessages(messages);
  if (!strictRoleFormatting && boolish(promptParameters?.squashSystemMessages, false)) {
    messages = squashLeadingSystemMessages(messages);
  }
  if (boolish(promptParameters?.singleUserMessage, false)) {
    messages = collapseToSingleUserMessage(messages);
  }
  const summaryFingerprint = fingerprintChatSummary(summary);

  return {
    messages,
    previewMessages,
    promptPresetId: presetId,
    parameters: selectedPreset?.parameters ?? null,
    wrapFormat,
    characters,
    persona,
    activatedLorebookEntries: processedLore.includedEntries.map(loreForEvent),
    budgetSkippedLorebookEntries,
    chatSummary: summary,
    chatSummaryFingerprint: summaryFingerprint,
  };
}
