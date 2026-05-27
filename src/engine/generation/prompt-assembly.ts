import type { LorebookEntry } from "../contracts/types/lorebook";
import type { ChatMLMessage, MarkerConfig, WrapFormat } from "../contracts/types/prompt";
import type { StorageGateway } from "../capabilities/storage";
import { injectAtDepth, processActivatedEntries } from "../generation-core/lorebooks/prompt-injector";
import { scanForActivatedEntries, type ActivatedEntry } from "../generation-core/lorebooks/keyword-scanner";
import { wrapContent } from "../generation-core/prompt/format-engine";
import { mergeAdjacentMessages, squashLeadingSystemMessages } from "../generation-core/prompt/merger";
import { applyRegexScriptsToPromptMessages } from "../generation-core/regex/regex-application";
import { resolveMacros, type MacroContext } from "../shared/macros/macro-engine";
import { normalizeUserTimeZone } from "../shared/time/timezone";
import type { GameActiveState, GameCampaignPlan, GameMap, GameNpc, HudWidget, SessionSummary } from "../contracts/types/game";
import { buildGmFormatReminder, buildGmSystemPrompt, type GmPromptContext } from "../modes/game/prompts/gm-prompts";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { activeCharacterIds } from "./active-characters";
import { buildGenerationPromptPresetCandidates } from "./prompt-preset-selection";
import {
  bySortOrder,
  boolish,
  hiddenFromAi,
  isRecord,
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
  personaStats?: { enabled: boolean; bars: Array<{ name: string; value: number; max: number; color: string }> };
  rpgStats?: {
    enabled: boolean;
    attributes: Array<{ name: string; value: number }>;
    hp: { value: number; max: number };
  };
}

export interface PromptAssemblyResult {
  messages: ChatMLMessage[];
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
}

type PromptSectionRecord = JsonRecord & {
  role?: unknown;
  content?: unknown;
  name?: unknown;
  identifier?: unknown;
  markerConfig?: unknown;
};

const PARTY_NPC_ID_PREFIX = "npc:";

function dataRecord(record: JsonRecord): JsonRecord {
  const data = parseRecord(record.data);
  return Object.keys(data).length > 0 ? data : record;
}

function field(source: JsonRecord, key: string): string {
  return readString(source[key]).trim();
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

function loadCharacterContext(record: JsonRecord): GenerationCharacterContext {
  const data = dataRecord(record);
  const name = field(data, "name") || field(record, "name") || "Character";
  return {
    id: field(record, "id") || field(data, "id") || name,
    name,
    description: field(data, "description") || field(record, "description"),
    personality: field(data, "personality") || undefined,
    scenario: field(data, "scenario") || undefined,
    creatorNotes: field(data, "creator_notes") || field(data, "creatorNotes") || undefined,
    systemPrompt: field(data, "system_prompt") || field(data, "systemPrompt") || undefined,
    backstory: field(data, "backstory") || undefined,
    appearance: field(data, "appearance") || undefined,
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
    hasSceneModel: !!(
      readString(meta.gameSceneConnectionId).trim() ||
      readString(setup.sceneConnectionId).trim()
    ),
    playerMoved: true,
    turnNumber: input.storedMessages.filter((message) => readString(message.role) === "user").length + 1,
    moraleContext:
      meta.gameMorale == null
        ? undefined
        : `Current party morale: ${readNumber(meta.gameMorale, 50)} / 100.`,
    playerInventory: normalizeGameInventory(meta.gameInventory),
    language: readString(setup.language).trim() || undefined,
  };

  let systemPrompt = buildGmSystemPrompt(gmCtx);
  const customGmPrompt = readString(meta.customGmPrompt).trim();
  if (customGmPrompt) systemPrompt = `${systemPrompt}\n\n${customGmPrompt}`;
  const extraPrompt = readString(meta.gameExtraPrompt).trim().replace(/<\/?special_instructions>/gi, "");
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

function promptPresetId(chat: JsonRecord, connection: JsonRecord, request: JsonRecord, defaultPromptId: string | null) {
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  const candidates = buildGenerationPromptPresetCandidates({
    chatMode: mode,
    chatPromptPresetId: chat.promptPresetId,
    connectionPromptPresetId: connection.promptPresetId,
    impersonate: request.impersonate === true,
    impersonatePromptPresetId: request.impersonatePresetId,
    requestPromptPresetId: readString(request.promptPresetId).trim() || readString(request.presetId).trim(),
  });
  return candidates[0]?.id ?? (mode === "conversation" ? null : defaultPromptId);
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
    variables: stringRecord(input.chat.promptVariables ?? input.chat.variableValues),
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

function renderCharacters(characters: GenerationCharacterContext[]): string {
  return characters
    .map((character) =>
      [
        ["Name", character.name],
        ["Description", character.description],
        ["Personality", character.personality],
        ["Scenario", character.scenario],
        ["Backstory", character.backstory],
        ["Appearance", character.appearance],
        ["First Message", character.firstMes],
        ["System Prompt", character.systemPrompt],
        ["Post History Instructions", character.postHistoryInstructions],
      ]
        .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
        .map(([label, value]) => `${label}: ${value}`)
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
}

function renderDialogueExamples(characters: GenerationCharacterContext[]): string {
  return characters
    .map((character) => character.mesExample)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n\n");
}

function renderPersona(persona: GenerationPersonaContext | null): string {
  if (!persona) return "";
  return [
    ["Name", persona.name],
    ["Description", persona.description],
    ["Personality", persona.personality],
    ["Backstory", persona.backstory],
    ["Appearance", persona.appearance],
    ["Scenario", persona.scenario],
  ]
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function renderJsonBlock(label: string, value: unknown): string {
  const record = parseRecord(value);
  if (Object.keys(record).length === 0) return "";
  return `${label}:\n${JSON.stringify(record, null, 2).slice(0, 4000)}`;
}

function fallbackSystemPrompt(input: PromptAssemblyInput, args: {
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  worldBefore: string;
  worldAfter: string;
  summary: string | null;
}): string {
  const mode = readString(input.chat.mode || input.chat.chatMode, "conversation");
  const meta = parseRecord(input.chat.metadata);
  const common = [
    renderCharacters(args.characters),
    renderPersona(args.persona),
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

function buildRoleplayScenePromptBlock(
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  persona: GenerationPersonaContext | null,
): string | null {
  const meta = parseRecord(chat.metadata);
  if (readString(chat.mode || chat.chatMode) !== "roleplay" && readString(meta.sceneStatus) !== "active") return null;
  const parts: string[] = [];
  const characterNames = characters.map((character) => character.name).filter(Boolean);
  const playerName = persona?.name || "the user";
  const roleLines = [
    "This is a dedicated roleplay scene, not a normal conversation and not game mode.",
    characterNames.length
      ? `Play the scene characters: ${characterNames.join(", ")}. The player controls ${playerName}.`
      : `The player controls ${playerName}.`,
    "Continue the scene with immersive action, dialogue, and narration. Do not use game HUD/mechanics unless the scene explicitly established them.",
  ];
  parts.push(`<scene_role>\n${roleLines.join("\n")}\n</scene_role>`);

  const awareness: string[] = [];
  const relationship = readString(meta.sceneRelationshipHistory).trim();
  if (relationship) awareness.push(`Relationship history:\n${relationship}`);
  const context = readString(meta.sceneConversationContext).trim();
  if (context) awareness.push(`Conversation context before the scene:\n${context}`);
  const previous = readString(meta.lastRoleplaySceneSummary).trim();
  if (previous) awareness.push(`Previous scene continuity:\n${previous}`);
  if (awareness.length) parts.push(`<awareness>\n${awareness.join("\n\n")}\n</awareness>`);

  const scenario = readString(meta.sceneScenario).trim() || readString(meta.sceneDescription).trim();
  if (scenario) parts.push(`<scene_scenario>\n${scenario}\n</scene_scenario>`);
  const instructions = readString(meta.sceneSystemPrompt).trim();
  if (instructions) parts.push(`<scene_instructions>\n${instructions}\n</scene_instructions>`);
  parts.push(
    [
      "<output_format>",
      "Continue directly from the last visible message.",
      "Keep character knowledge bounded to what they witnessed, inferred, or were told.",
      `Never decide ${playerName}'s strategic choices or exact dialogue. End naturally when it is the player's turn.`,
      "Use vivid, specific prose and distinct character voices. Avoid repeating the user's phrasing.",
      "</output_format>",
    ].join("\n"),
  );

  return parts.join("\n\n");
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
    .map((value) => (typeof value === "string" ? value : isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : ""))
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

function memoryVector(memory: JsonRecord): number[] | null {
  if (!Array.isArray(memory.embedding)) return null;
  const vector = memory.embedding.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return vector.length === MEMORY_EMBEDDING_DIMS ? vector : null;
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

  const queryVector = lexicalMemoryEmbedding(latestUserInput);
  const queryTokens = new Set(latestUserInput.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
  const recalled = memories
    .map((memory) => {
      const content = readString(memory.content).trim();
      if (!content) return null;
      const vector = memoryVector(memory) ?? lexicalMemoryEmbedding(content);
      const haystack = content.toLowerCase();
      const lexicalScore = Array.from(queryTokens).reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      const similarity = cosineSimilarity(queryVector, vector) + Math.min(0.2, lexicalScore * 0.025);
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

function normalizeRole(value: unknown): "system" | "user" | "assistant" {
  return value === "system" || value === "assistant" ? value : "user";
}

function historyMessages(storedMessages: JsonRecord[], limit: number): ChatMLMessage[] {
  return storedMessages
    .filter((message) => !hiddenFromAi(message))
    .slice(-limit)
    .map((message) => ({
      role: normalizeRole(message.role),
      content: readString(message.content).trim(),
      contextKind: "history" as const,
      characterId: readString(message.characterId).trim() || undefined,
      name: readString(message.name).trim() || undefined,
    }))
    .filter((message) => message.content.length > 0);
}

function findHistoryBounds(messages: ChatMLMessage[]): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]!.contextKind !== "history") continue;
    if (start === -1) start = index;
    end = index + 1;
  }
  return start >= 0 ? { start, end } : null;
}

function shouldMergeSameRolePromptMessage(
  previous: ChatMLMessage | undefined,
  message: ChatMLMessage,
  effectiveRole: "user" | "assistant",
): previous is ChatMLMessage {
  if (!previous || previous.role !== effectiveRole) return false;

  const previousCharacterId = previous.characterId ?? null;
  const messageCharacterId = message.characterId ?? null;
  const bothCharacterHistory =
    previous.contextKind === "history" &&
    message.contextKind === "history" &&
    previousCharacterId !== null &&
    messageCharacterId !== null;

  // Keep distinct group-chat speakers split until individual response scoping
  // has decided which history turns belong to the active speaker.
  return !(bothCharacterHistory && previousCharacterId !== messageCharacterId);
}

function mergeIntoPreviousPromptMessage(previous: ChatMLMessage, message: ChatMLMessage): void {
  previous.content += "\n\n" + message.content;
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
  if (message.providerMetadata) {
    previous.providerMetadata = message.providerMetadata;
  }
}

function enforceStrictRoles(messages: ChatMLMessage[]): ChatMLMessage[] {
  if (messages.length === 0) return messages;
  const historyEnd = findHistoryBounds(messages)?.end ?? -1;
  const normalizedMessages =
    historyEnd > 0
      ? messages.map((message, index) =>
          index >= historyEnd && message.role === "system" ? { ...message, role: "user" as const } : message,
        )
      : messages;

  const result: ChatMLMessage[] = [];
  let index = 0;
  const systemParts: string[] = [];
  while (index < normalizedMessages.length && normalizedMessages[index]!.role === "system") {
    systemParts.push(normalizedMessages[index]!.content);
    index += 1;
  }
  if (systemParts.length > 0) {
    result.push({ role: "system", content: systemParts.join("\n\n"), contextKind: "prompt" });
  }

  let expectedRole: "user" | "assistant" = "user";
  for (; index < normalizedMessages.length; index += 1) {
    const message = normalizedMessages[index]!;
    const effectiveRole = message.role === "system" ? "user" : message.role;
    if (effectiveRole === expectedRole) {
      result.push({ ...message, role: effectiveRole });
      expectedRole = effectiveRole === "user" ? "assistant" : "user";
      continue;
    }

    const previous = result[result.length - 1];
    if (shouldMergeSameRolePromptMessage(previous, message, effectiveRole)) {
      mergeIntoPreviousPromptMessage(previous, message);
      continue;
    }

    result.push({ ...message, role: effectiveRole });
    expectedRole = effectiveRole === "user" ? "assistant" : "user";
  }

  return result;
}

function normalizeLorebookEntry(entry: JsonRecord): LorebookEntry {
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
    scanDepth: readNumber(entry.scanDepth, 0),
    sticky: entry.sticky == null ? null : readNumber(entry.sticky, 0),
    cooldown: entry.cooldown == null ? null : readNumber(entry.cooldown, 0),
    delay: entry.delay == null ? null : readNumber(entry.delay, 0),
    activationConditions: Array.isArray(entry.activationConditions) ? entry.activationConditions : [],
    schedule: isRecord(entry.schedule) ? (entry.schedule as unknown as LorebookEntry["schedule"]) : null,
    excludeFromVectorization: boolish(entry.excludeFromVectorization, false),
    embedding: Array.isArray(entry.embedding) ? entry.embedding.filter((item): item is number => typeof item === "number") : null,
    additionalMatchingSources: stringArray(entry.additionalMatchingSources) as LorebookEntry["additionalMatchingSources"],
    characterFilterMode: readString(entry.characterFilterMode, "any") as LorebookEntry["characterFilterMode"],
    characterFilterIds: stringArray(entry.characterFilterIds),
    characterTagFilterMode: readString(entry.characterTagFilterMode, "any") as LorebookEntry["characterTagFilterMode"],
    characterTagFilters: stringArray(entry.characterTagFilters),
    generationTriggerFilterMode: readString(entry.generationTriggerFilterMode, "any") as LorebookEntry["generationTriggerFilterMode"],
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
  const meta = parseRecord(chat.metadata);
  return stringArray(meta.activeLorebookIds ?? chat.activeLorebookIds).includes(readString(lorebook.id));
}

async function loadActivatedLore(
  storage: StorageGateway,
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  persona: GenerationPersonaContext | null,
  storedMessages: JsonRecord[],
): Promise<ActivatedEntry[]> {
  const lorebooks = (await storage.list<JsonRecord>("lorebooks")).filter((book) =>
    lorebookAppliesToContext(book, chat, characters, persona),
  );
  const rows = (
    await Promise.all(
      lorebooks.map(async (book) => {
        const id = readString(book.id);
        // The refactor storage API has no path-style routes; use the
        // dedicated capability that filters lorebook-entries by lorebookId.
        return id ? storage.listLorebookEntries<JsonRecord>(id) : [];
      }),
    )
  ).flat();
  const entries = rows.map(normalizeLorebookEntry).filter((entry) => entry.enabled && entry.content.trim());
  const activeCharacterIds = characters.map((character) => character.id);
  const activeCharacterTags = characters.flatMap((character) => character.tags);
  const meta = parseRecord(chat.metadata);
  const gameState = parseRecord(chat.gameState ?? meta.gameState);
  return scanForActivatedEntries(
    storedMessages.filter((message) => !hiddenFromAi(message)).map((message) => ({
      role: readString(message.role, "user"),
      content: readString(message.content),
    })),
    entries,
    { activeCharacterIds, activeCharacterTags, generationTriggers: ["chat", readString(chat.mode)], gameState },
  );
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

function sectionContent(args: {
  section: PromptSectionRecord;
  marker: MarkerConfig | null;
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  worldBefore: string;
  worldAfter: string;
  summary: string | null;
  agentData: Record<string, string>;
}) {
  switch (args.marker?.type) {
    case "character":
      return renderCharacters(args.characters);
    case "persona":
      return renderPersona(args.persona);
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
        ? args.agentData[args.marker.agentType] ?? ""
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
  const activated = await loadActivatedLore(storage, input.chat, characters, persona, input.storedMessages);
  const processedLore = processActivatedEntries(activated, readNumber(input.request.lorebookTokenBudget, 0));
  const summary = chatSummaryForGeneration(input.chat);
  const memoryRecallBlock = await buildMemoryRecallBlock(
    storage,
    input.chat,
    input.latestUserInput,
    readNumber(input.connection.maxContext, 0) || undefined,
  );
  const defaultPrompt = await loadDefaultPromptId(storage);
  const presetId = promptPresetId(input.chat, input.connection, input.request, defaultPrompt);
  const wrapFormat = (readString(input.chat.wrapFormat) || readString(input.connection.wrapFormat) || "xml") as WrapFormat;
  const historyLimit = Math.max(1, Math.min(300, readNumber(input.request.historyLimit, 80)));
  const history = historyMessages(input.storedMessages, historyLimit);
  const macros = macroContext({
    chat: input.chat,
    connection: input.connection,
    characters,
    persona,
    latestUserInput: input.latestUserInput,
    agentData: input.agentData,
    request: input.request,
  });
  const agentData = input.agentData ?? {};
  let messages: ChatMLMessage[] = [];
  let insertedHistory = false;

  if (presetId) {
    const sections = await loadPromptSections(storage, presetId);
    for (const section of sections) {
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
        characters,
        persona,
        worldBefore: processedLore.worldInfoBefore,
        worldAfter: processedLore.worldInfoAfter,
        summary,
        agentData,
      });
      const resolved = resolveMacros(rawContent, macros);
      if (!resolved.trim()) continue;
      const name = readString(section.name) || readString(section.identifier) || marker?.type || "Prompt";
      messages.push({
        role: normalizeRole(section.role),
        content: wrapContent(resolved, name, wrapFormat),
        contextKind: "prompt",
      });
    }
  }

  if (messages.length === 0) {
    messages.push({
      role: "system",
      content: fallbackSystemPrompt(input, {
        characters,
        persona,
        worldBefore: processedLore.worldInfoBefore,
        worldAfter: processedLore.worldInfoAfter,
        summary,
      }),
      contextKind: "prompt",
    });
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
    const sceneBlock = buildRoleplayScenePromptBlock(input.chat, characters, persona);
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

  messages = injectAtDepth(messages, processedLore.depthEntries);
  const regexScripts = await storage.list<JsonRecord>("regex-scripts");
  applyRegexScriptsToPromptMessages(messages, regexScripts, {
    resolveMacros: (value) => resolveMacros(value, macros, { trimResult: false }),
  });
  const strictRoleFormatting =
    boolish(input.request.strictRoleFormatting, true) && (chatMode === "roleplay" || chatMode === "visual_novel");
  messages = strictRoleFormatting ? enforceStrictRoles(messages) : mergeAdjacentMessages(messages);
  if (!strictRoleFormatting && boolish(input.request.squashSystemMessages, false)) {
    messages = squashLeadingSystemMessages(messages);
  }
  const summaryFingerprint = fingerprintChatSummary(summary);

  return {
    messages,
    characters,
    persona,
    activatedLorebookEntries: activated.map(loreForEvent),
    chatSummary: summary,
    chatSummaryFingerprint: summaryFingerprint,
  };
}
