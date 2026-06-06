import type { LorebookEntryTimingState } from "../contracts/types/lorebook";
import type { ChatMLMessage, MarkerConfig, WrapFormat } from "../contracts/types/prompt";
import type { CharacterData } from "../contracts/types/character";
import { BUILT_IN_AGENTS } from "../contracts/types/agent";
import {
  DEFAULT_CONVERSATION_SYSTEM_PROMPT,
  DEFAULT_GROUP_CONVERSATION_SYSTEM_PROMPT,
} from "../contracts/constants/conversation-prompt";
import type { ListChatMemoriesOptions, StorageGateway } from "../capabilities/storage";
import type { VisualAssetGateway } from "../capabilities/visual-assets";
import { getCharacterDescriptionWithExtensions } from "../generation-core/prompt/character-description-extensions";
import { injectAtDepth } from "../generation-core/lorebooks/prompt-injector";
import { wrapContent, wrapGroup } from "../generation-core/prompt/format-engine";
import {
  canMergePromptMessages,
  mergeAdjacentMessages,
  mergePromptContextKind,
  squashLeadingSystemMessages,
} from "../generation-core/prompt/merger";
import { applyRegexScriptsToPromptMessages } from "../generation-core/regex/regex-application";
import { stripConversationPromptTimestamps } from "../modes/chat/core/summaries/transcript-sanitize";
import {
  hasDeferredCharacterMacros,
  resolveDeferredCharacterMacros,
  resolveMacros,
  type MacroContext,
} from "../shared/macros/macro-engine";
import { normalizeChatSummaryMetadata } from "../shared/text/chat-summary-entries";
import { collapseExcessBlankLines } from "../shared/text/newlines";
import { cleanPromptText, stripPromptComments } from "../shared/text/prompt-comments";
import { formatZonedDate, formatZonedTime, getZonedWeekdayName, normalizeUserTimeZone } from "../shared/time/timezone";
import type {
  GameActiveState,
  GameCampaignPlan,
  GameMap,
  GameNpc,
  HudWidget,
  SessionSummary,
} from "../contracts/types/game";
import { buildGmFormatReminder, buildGmSystemPrompt, type GmPromptContext } from "../modes/game/prompts/gm-prompts";
import { loadCharacterSprites, type CharacterSpriteSubject } from "../modes/game/prompts/sprite.service";
import { formatMoraleContext, getMoraleTier } from "../modes/game/mechanics/morale.service";
import { formatPerceptionHints, generatePerceptionHints } from "../modes/game/mechanics/perception.service";
import { applyAllSegmentEdits } from "../modes/game/state/segment-edits";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { activeCharacterIds } from "./active-characters";
import {
  generationParameterSources,
  mergeStoredGenerationParameters,
  type StoredGenerationParameters,
} from "./generate-route-utils";
import { effectiveMaxContext } from "./context-window";
import { buildGenerationPromptPresetCandidates } from "./prompt-preset-selection";
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
import {
  lorebookActivatedEntryForEvent,
  scanActiveLorebooks,
  type ActiveLorebookIncludedPositions,
  type ActiveLorebookScannerResult,
  type BudgetSkippedLorebookEntry,
} from "./active-lorebook-scanner";

export interface GenerationCharacterContext {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  avatarFilePath?: string;
  avatarFilename?: string;
  personality?: string;
  scenario?: string;
  creatorNotes?: string;
  systemPrompt?: string;
  backstory?: string;
  appearance?: string;
  mesExample?: string;
  firstMes?: string;
  postHistoryInstructions?: string;
  depthPrompt?: GenerationCharacterDepthPrompt;
  tags: string[];
}

interface GenerationCharacterDepthPrompt {
  prompt: string;
  depth: number;
  role: "system" | "user" | "assistant";
}

export interface GenerationPersonaContext {
  name: string;
  description: string;
  avatarUrl?: string;
  avatarFilePath?: string;
  avatarFilename?: string;
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
  lorebookTimingStates: Record<string, LorebookEntryTimingState> | null;
  lorebookEntryStateOverrides: Record<string, { ephemeral?: number | null; enabled?: boolean }> | null;
  budgetSkippedLorebookEntries: BudgetSkippedLorebookEntry[];
  chatSummary: string | null;
  chatSummaryFingerprint: string | null;
  reusableContext: PromptAssemblyReusableContext;
}

export interface PromptAssemblyInput {
  chat: JsonRecord;
  storedMessages: JsonRecord[];
  connection: JsonRecord;
  request: JsonRecord;
  latestUserInput: string;
  agentData?: Record<string, string>;
  embeddingSource?: {
    embed(
      texts: string[],
      request?: { connectionId?: string | null; model?: string | null },
    ): Promise<number[][] | null>;
  } | null;
  visuals?: VisualAssetGateway;
  persistPromptVariables?: boolean;
  reusableContext?: PromptAssemblyReusableContext;
}

interface PromptAssemblyReusableContext {
  chatMeta: JsonRecord;
  chatMode: string;
  storedMessages: JsonRecord[];
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  selectedPreset: SelectedPromptPreset | null;
  presetId: string | null;
  promptParameters: StoredGenerationParameters | null;
  maxContext: number | null;
  wrapFormat: WrapFormat;
  groupScenarioOverride: GroupScenarioOverride;
  promptCharacters: GenerationCharacterContext[];
  baseLorebookIncludedPositions: ActiveLorebookIncludedPositions;
  loreScan: ActiveLorebookScannerResult;
  processedLore: ActiveLorebookScannerResult["processedLore"];
  summary: string | null;
  memoryRecallBlock: string | null;
  history: ChatMLMessage[];
  greetingPromptVariables: Record<string, string>;
  macroSensitiveScope: {
    deferCharacterMacros: boolean;
    targetCharacterId: string | null;
  };
}

type PromptSectionRecord = JsonRecord & {
  role?: unknown;
  content?: unknown;
  name?: unknown;
  identifier?: unknown;
  markerConfig?: unknown;
  groupId?: unknown;
};

type PromptChoiceBlockRecord = JsonRecord & {
  variableName?: unknown;
  options?: unknown;
  multiSelect?: unknown;
  separator?: unknown;
  randomPick?: unknown;
};

type PromptGroupRecord = JsonRecord & {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
};

type PromptPresetBundle = {
  preset: JsonRecord;
  sections: PromptSectionRecord[];
  groups: PromptGroupRecord[];
  choiceBlocks: PromptChoiceBlockRecord[];
};

type PromptAssemblyEntry = ChatMLMessage & {
  promptGroupId?: string | null;
  promptGroupName?: string | null;
};

type GroupScenarioOverride = {
  enabled: boolean;
  text: string;
};

const NO_GROUP_SCENARIO_OVERRIDE: GroupScenarioOverride = { enabled: false, text: "" };

interface SelectedPromptPreset {
  id: string;
  preset: JsonRecord | null;
  sections: PromptSectionRecord[];
  groups: PromptGroupRecord[];
  variables: Record<string, string>;
  choiceVariableNames: string[];
  parameters: StoredGenerationParameters | null;
  wrapFormat: WrapFormat | null;
}

const PARTY_NPC_ID_PREFIX = "npc:";
const TRACKER_AGENT_IDS = new Set(
  BUILT_IN_AGENTS.filter((agent) => agent.category === "tracker").map((agent) => agent.id),
);
const TRACKER_PROMPT_METADATA_KEYS = new Set([
  "id",
  "chatId",
  "createdAt",
  "updatedAt",
  "target",
  "targetKind",
  "targetMessageId",
  "messageId",
  "assistantMessageId",
  "turnId",
  "swipeIndex",
  "committed",
  "manual",
  "targetVisible",
  "version",
  "avatarPath",
  "portraitFocusX",
  "portraitFocusY",
  "portraitZoom",
  "characterId",
  "statId",
  "inventoryItemId",
  "objectiveId",
  "questEntryId",
  "customFieldId",
  "color",
]);

function dataRecord(record: JsonRecord): JsonRecord {
  const data = parseRecord(record.data);
  return Object.keys(data).length > 0 ? data : record;
}

function field(source: JsonRecord, key: string): string {
  return cleanPromptText(readString(source[key]));
}

function rawField(source: JsonRecord, key: string): string {
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

function normalizeWrapFormat(value: unknown): WrapFormat | null {
  return value === "xml" || value === "markdown" || value === "none" ? value : null;
}

function primitiveChoiceValue(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : null;
}

function selectedChoiceCandidates(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((entry) => primitiveChoiceValue(entry) ?? []);
  const single = primitiveChoiceValue(value);
  return single === null ? [] : [single];
}

function promptChoiceOptionValues(block: PromptChoiceBlockRecord): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const option of parseArray(block.options)) {
    const value = isRecord(option) ? primitiveChoiceValue(option.value) : primitiveChoiceValue(option);
    if (value === null || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function choiceBlockVariableName(block: PromptChoiceBlockRecord): string {
  return readString(block.variableName ?? block.variable_name).trim();
}

function hasOwnChoice(record: JsonRecord, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, name);
}

function normalizedSelectionValue(
  value: unknown,
  block: PromptChoiceBlockRecord,
  hasSelection: boolean,
): string | null {
  const optionValues = promptChoiceOptionValues(block);
  if (optionValues.length === 0) return null;

  const validValues = new Set(optionValues);
  const candidates = selectedChoiceCandidates(value);
  const values = candidates.filter((entry, index) => validValues.has(entry) && candidates.indexOf(entry) === index);

  if (boolish(block.multiSelect ?? block.multi_select, false)) {
    if (values.length === 0) return hasSelection ? "" : (optionValues[0] ?? null);
    if (boolish(block.randomPick ?? block.random_pick, false)) {
      return values[Math.floor(Math.random() * values.length)] ?? values[0] ?? null;
    }
    return values.join(readString(block.separator, ", "));
  }

  if (values.length === 0) {
    return hasSelection ? "" : (optionValues[0] ?? null);
  }

  return values[0] ?? null;
}

function promptChoiceVariables(input: {
  defaultChoices: unknown;
  chatChoices: unknown;
  blocksByName: Map<string, PromptChoiceBlockRecord>;
}): Record<string, string> {
  const defaultChoices = parseRecord(input.defaultChoices);
  const chatChoices = parseRecord(input.chatChoices);
  const variables: Record<string, string> = {};
  for (const [name, block] of input.blocksByName.entries()) {
    const hasChatChoice = hasOwnChoice(chatChoices, name);
    const hasDefaultChoice = hasOwnChoice(defaultChoices, name);
    const value = hasChatChoice ? chatChoices[name] : hasDefaultChoice ? defaultChoices[name] : undefined;
    const normalized = normalizedSelectionValue(value, block, hasChatChoice || hasDefaultChoice);
    if (normalized !== null) variables[name] = normalized;
  }
  return variables;
}

function resolvePromptChoiceVariableMacros(
  macros: MacroContext,
  variableNames: string[],
  deferCharacterMacros: boolean,
): void {
  const uniqueNames = new Set(variableNames);
  for (const name of uniqueNames) {
    const value = macros.variables[name];
    if (value === undefined || !value.includes("{{")) continue;
    macros.variables[name] = resolvePromptMacros(value, macros, deferCharacterMacros);
  }
}

function chatPromptVariables(chat: JsonRecord): Record<string, string> {
  return {
    ...stringRecord(chat.variableValues),
    ...stringRecord(chat.promptVariables),
  };
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
    avatarUrl:
      rawField(data, "avatarPath") ||
      rawField(data, "avatarUrl") ||
      rawField(data, "avatar") ||
      rawField(record, "avatarPath") ||
      rawField(record, "avatarUrl") ||
      rawField(record, "avatar") ||
      undefined,
    avatarFilePath: rawField(data, "avatarFilePath") || rawField(record, "avatarFilePath") || undefined,
    avatarFilename: rawField(data, "avatarFilename") || rawField(record, "avatarFilename") || undefined,
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
    depthPrompt: characterDepthPrompt(data, extensions),
    tags: stringArray(data.tags ?? record.tags),
  };
}

function normalizeDepthPromptRole(value: unknown): "system" | "user" | "assistant" {
  return value === "user" || value === "assistant" ? value : "system";
}

function normalizeDepthPromptDepth(value: unknown): number {
  return Math.max(0, Math.floor(readNumber(value, 4)));
}

function characterDepthPrompt(data: JsonRecord, extensions: JsonRecord): GenerationCharacterDepthPrompt | undefined {
  const promptValue = extensions.depth_prompt ?? data.depth_prompt;
  const depthPrompt = parseRecord(promptValue);
  const objectPrompt = readString(depthPrompt.prompt).trim();
  const stringPrompt = typeof promptValue === "string" ? promptValue.trim() : "";
  const prompt = cleanPromptText(objectPrompt || stringPrompt);
  if (!prompt) return undefined;
  return {
    prompt,
    depth: normalizeDepthPromptDepth(depthPrompt.depth ?? extensions.depth_prompt_depth ?? data.depth_prompt_depth),
    role: normalizeDepthPromptRole(depthPrompt.role ?? extensions.depth_prompt_role ?? data.depth_prompt_role),
  };
}

function loadPersonaContext(record: JsonRecord): GenerationPersonaContext {
  const data = dataRecord(record);
  const personaStats = personaStatsContext(data.personaStats ?? record.personaStats);
  return {
    name: field(data, "name") || field(record, "name") || "User",
    description: personaDescriptionWithActiveExtensions(data, record),
    avatarUrl:
      rawField(data, "avatarPath") ||
      rawField(data, "avatarUrl") ||
      rawField(data, "avatar") ||
      rawField(record, "avatarPath") ||
      rawField(record, "avatarUrl") ||
      rawField(record, "avatar") ||
      undefined,
    avatarFilePath: rawField(data, "avatarFilePath") || rawField(record, "avatarFilePath") || undefined,
    avatarFilename: rawField(data, "avatarFilename") || rawField(record, "avatarFilename") || undefined,
    personality: field(data, "personality") || undefined,
    backstory: field(data, "backstory") || undefined,
    appearance: field(data, "appearance") || undefined,
    scenario: field(data, "scenario") || undefined,
    tags: stringArray(data.tags ?? record.tags),
    personaStats,
    rpgStats: personaRpgStatsContext(data, record),
  };
}

function personaDescriptionWithActiveExtensions(data: JsonRecord, record: JsonRecord): string {
  const base = field(data, "description") || field(record, "description");
  const extensions = activeAltDescriptionTexts(
    data.altDescriptions ?? record.altDescriptions ?? parseRecord(data.extensions).altDescriptions,
  );
  return [base, ...extensions].filter(Boolean).join("\n");
}

function activeAltDescriptionTexts(value: unknown): string[] {
  return parseArray(value)
    .map(parseRecord)
    .filter((entry) => boolish(entry.active, false))
    .map((entry) => cleanPromptText(readString(entry.content)))
    .filter(Boolean);
}

function personaStatsContext(value: unknown): GenerationPersonaContext["personaStats"] | undefined {
  return isPersonaStats(value);
}

function personaRpgStatsContext(
  data: JsonRecord,
  record: JsonRecord,
): GenerationPersonaContext["rpgStats"] | undefined {
  return (
    isRpgStats(data.rpgStats) ??
    isRpgStats(parseRecord(data.personaStats).rpgStats) ??
    isRpgStats(parseRecord(record.personaStats).rpgStats)
  );
}

function isPersonaStats(value: unknown): GenerationPersonaContext["personaStats"] | undefined {
  const record = parseRecord(value);
  if (typeof record.enabled !== "boolean" || !Array.isArray(record.bars)) return undefined;
  const bars = record.bars.filter(
    (bar): bar is { name: string; value: number; max: number; color: string } =>
      isRecord(bar) &&
      typeof bar.name === "string" &&
      typeof bar.value === "number" &&
      typeof bar.max === "number" &&
      typeof bar.color === "string",
  );
  return { enabled: record.enabled, bars };
}

function isRpgStats(value: unknown): GenerationPersonaContext["rpgStats"] | undefined {
  const record = parseRecord(value);
  if (typeof record.enabled !== "boolean" || !isRecord(record.hp)) return undefined;
  const attributes = Array.isArray(record.attributes)
    ? record.attributes.filter(
        (attr): attr is { name: string; value: number } =>
          isRecord(attr) && typeof attr.name === "string" && typeof attr.value === "number",
      )
    : [];
  const hp = {
    value: readNumber(record.hp.value, 0),
    max: readNumber(record.hp.max, 0),
  };
  return { enabled: record.enabled, attributes, hp };
}

export async function loadCharacters(storage: StorageGateway, chat: JsonRecord): Promise<GenerationCharacterContext[]> {
  const ids = activeCharacterIds(chat);
  const rows = await Promise.all(ids.map((id) => storage.get<JsonRecord>("characters", id)));
  return rows.filter(isRecord).map(loadCharacterContext);
}

export async function loadPersona(storage: StorageGateway, chat: JsonRecord): Promise<GenerationPersonaContext | null> {
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

function groupScenarioOverride(meta: JsonRecord): GroupScenarioOverride {
  if (!boolish(meta.groupScenarioOverride, false)) return NO_GROUP_SCENARIO_OVERRIDE;
  return { enabled: true, text: cleanPromptText(readString(meta.groupScenarioText).trim()) };
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
  const dangerLevel = readNormalizedNumber(
    state,
    ["dangerLevel"],
    readNormalizedNumber(meta, ["gameDangerLevel"], Number.NaN),
  );
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
  const spriteSubjects: CharacterSpriteSubject[] = [];

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
    spriteSubjects.push({ id: character.id, name: character.name });
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

  const gameMorale = meta.gameMorale == null ? null : readNumber(meta.gameMorale, 50);

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
      gameMorale == null ? undefined : formatMoraleContext({ value: gameMorale, tier: getMoraleTier(gameMorale) }),
    characterSprites: await loadCharacterSprites(input.visuals, spriteSubjects),
    playerInventory: normalizeGameInventory(meta.gameInventory),
    language: readString(setup.language).trim() || undefined,
    canGenerateBackgrounds:
      boolish(meta.enableSpriteGeneration, false) &&
      !!(readString(meta.gameImageConnectionId).trim() || readString(setup.imageConnectionId).trim()),
    artStylePrompt: readString(setup.artStylePrompt).trim() || undefined,
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
    canGenerateBackgrounds: gmCtx.canGenerateBackgrounds,
    artStylePrompt: gmCtx.artStylePrompt,
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

async function loadPromptGroups(storage: StorageGateway, presetId: string): Promise<PromptGroupRecord[]> {
  const groups = await storage.list<PromptGroupRecord>("prompt-groups", { filters: { presetId } });
  return groups.filter(isRecord).sort(bySortOrder);
}

async function loadPromptPresetRecord(storage: StorageGateway, presetId: string): Promise<JsonRecord | null> {
  const direct = await storage.get<JsonRecord>("prompts", presetId).catch(() => null);
  if (direct && isRecord(direct)) return direct;
  const prompts = await storage.list<JsonRecord>("prompts").catch(() => []);
  return prompts.find((prompt) => readString(prompt.id).trim() === presetId) ?? null;
}

async function loadPromptPresetBundle(storage: StorageGateway, presetId: string): Promise<PromptPresetBundle | null> {
  const full = await storage.promptFull?.<JsonRecord>(presetId).catch(() => null);
  if (full && isRecord(full.preset)) {
    const sections = Array.isArray(full.sections)
      ? full.sections.filter(isRecord).sort(bySortOrder)
      : await loadPromptSections(storage, presetId);
    const groups = Array.isArray(full.groups)
      ? full.groups.filter(isRecord).sort(bySortOrder)
      : await loadPromptGroups(storage, presetId);
    const choiceBlocks = Array.isArray(full.choiceBlocks)
      ? full.choiceBlocks.filter(isRecord).sort(bySortOrder)
      : await loadPromptChoiceBlocks(storage, presetId);
    return {
      preset: full.preset,
      sections: sections as PromptSectionRecord[],
      groups: groups as PromptGroupRecord[],
      choiceBlocks: choiceBlocks as PromptChoiceBlockRecord[],
    };
  }

  const preset = await loadPromptPresetRecord(storage, presetId);
  if (!preset) return null;
  const [sections, groups, choiceBlocks] = await Promise.all([
    loadPromptSections(storage, presetId),
    loadPromptGroups(storage, presetId),
    loadPromptChoiceBlocks(storage, presetId),
  ]);
  return { preset, sections, groups, choiceBlocks };
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
    const { preset, sections, groups, choiceBlocks } = bundle;
    const blocksByName = new Map(
      choiceBlocks.map((block) => [choiceBlockVariableName(block), block] as const).filter(([name]) => name.length > 0),
    );
    const metadata = parseRecord(input.chat.metadata);
    const explicitVariables = chatPromptVariables(input.chat);
    const chatPresetId = readString(input.chat.promptPresetId).trim();
    const chatChoices = chatPresetId === presetId ? (metadata.presetChoices ?? input.chat.presetChoices) : null;
    const mode = readString(input.chat.mode || input.chat.chatMode, "conversation");
    const choiceVariables = promptChoiceVariables({
      defaultChoices: preset.defaultChoices ?? preset.default_choices,
      chatChoices,
      blocksByName,
    });

    return {
      id: presetId,
      preset,
      sections,
      groups,
      variables: {
        ...stringRecord(preset.variableValues),
        ...choiceVariables,
        ...explicitVariables,
      },
      choiceVariableNames: Object.keys(choiceVariables).filter((name) => explicitVariables[name] === undefined),
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

function promptGroupLookup(groups: PromptGroupRecord[]): Map<string, PromptGroupRecord> {
  const lookup = new Map<string, PromptGroupRecord>();
  for (const group of groups) {
    const id = readString(group.id).trim();
    if (id) lookup.set(id, group);
  }
  return lookup;
}

function promptGroupName(group: PromptGroupRecord): string {
  return readString(group.name).trim() || "Prompt Group";
}

function promptGroupForSection(
  section: PromptSectionRecord,
  groupsById: Map<string, PromptGroupRecord>,
): { id: string; name: string } | null {
  const groupId = readString(section.groupId).trim();
  if (!groupId) return null;
  const group = groupsById.get(groupId);
  if (!group || !boolish(group.enabled, true)) return null;
  return { id: groupId, name: promptGroupName(group) };
}

function groupedPromptMessages(entries: PromptAssemblyEntry[], wrapFormat: WrapFormat): ChatMLMessage[] {
  const messages: ChatMLMessage[] = [];
  let activeGroup: {
    id: string;
    name: string;
    role: ChatMLMessage["role"];
    contents: string[];
  } | null = null;

  const flushGroup = () => {
    if (!activeGroup) return;
    const content = wrapGroup(activeGroup.contents.join("\n\n"), activeGroup.name, wrapFormat);
    if (content.trim()) {
      messages.push({
        role: activeGroup.role,
        content,
        contextKind: "prompt",
        displayName: activeGroup.name,
      });
    }
    activeGroup = null;
  };

  for (const entry of entries) {
    const { promptGroupId, promptGroupName, ...message } = entry;
    if (!promptGroupId || !promptGroupName) {
      flushGroup();
      messages.push(message);
      continue;
    }
    if (!activeGroup || activeGroup.id !== promptGroupId || activeGroup.role !== message.role) {
      flushGroup();
      activeGroup = {
        id: promptGroupId,
        name: promptGroupName,
        role: message.role,
        contents: [],
      };
    }
    activeGroup.contents.push(message.content);
  }
  flushGroup();

  return messages;
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
  groupScenarioOverride: GroupScenarioOverride;
}): MacroContext {
  const first = input.characters[0];
  const scenarioValue = (scenario: string | undefined) =>
    input.groupScenarioOverride.enabled ? input.groupScenarioOverride.text : scenario;
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
      scenario: scenarioValue(character.scenario),
      example: character.mesExample,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
    })),
    variables: { ...(input.variables ?? chatPromptVariables(input.chat)) },
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
          scenario: scenarioValue(first.scenario),
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

function characterMarkerFieldValue(
  character: GenerationCharacterContext,
  fieldName: string,
  macros: MacroContext | null,
  groupScenarioOverride: GroupScenarioOverride,
): string {
  if (fieldName === "scenario" && groupScenarioOverride.enabled) return "";
  const value = characterFieldValue(character, fieldName);
  return macros
    ? resolveMacros(value, macroContextForCharacter(macros, character, groupScenarioOverride), { trimResult: false })
    : value;
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

function groupScenarioMacroContext(base: MacroContext, characters: GenerationCharacterContext[]): MacroContext {
  const names = characters.map((character) => character.name.trim()).filter(Boolean);
  const characterList = names.join(", ") || base.char;
  return {
    ...base,
    char: characterList,
    characters: names.length ? names : base.characters,
    characterProfiles: [],
    characterFields: {
      description: "",
      personality: "",
      backstory: "",
      appearance: "",
      scenario: "",
      example: "",
      systemPrompt: "",
      postHistoryInstructions: "",
    },
  };
}

function groupScenarioMarkerValue(
  text: string,
  macros: MacroContext | null,
  characters: GenerationCharacterContext[],
): string {
  return macros ? resolveMacros(text, groupScenarioMacroContext(macros, characters), { trimResult: false }) : text;
}

function renderCharacters(
  characters: GenerationCharacterContext[],
  wrapFormat: WrapFormat,
  marker: MarkerConfig | null,
  macros: MacroContext | null = null,
  groupScenarioOverride: GroupScenarioOverride = NO_GROUP_SCENARIO_OVERRIDE,
): string {
  const fields = characterMarkerFields(marker);
  const characterBlocks = characters
    .map((character) => {
      const content = renderNamedFields(
        [
          ["Name", character.name],
          ...fields.map((fieldName): [string, string] => [
            CHARACTER_FIELD_LABELS[fieldName] ?? fieldName,
            characterMarkerFieldValue(character, fieldName, macros, groupScenarioOverride),
          ]),
        ],
        wrapFormat,
        2,
      );
      if (!content) return "";
      return wrapFormat === "none" ? content : wrapContent(content, character.name, wrapFormat, 1);
    })
    .filter(Boolean);
  const groupScenarioBlock =
    groupScenarioOverride.enabled && groupScenarioOverride.text && fields.includes("scenario")
      ? renderNamedFields(
          [["Scenario", groupScenarioMarkerValue(groupScenarioOverride.text, macros, characters)]],
          wrapFormat,
          1,
        )
      : "";
  return [...characterBlocks, groupScenarioBlock].filter(Boolean).join("\n\n");
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

function activeTrackerAgentIds(meta: JsonRecord): string[] {
  return stringArray(meta.activeAgentIds).filter((id) => TRACKER_AGENT_IDS.has(id));
}

type TrackerPromptSection = {
  key: string;
  label: string;
  value: unknown;
};

function trackerPromptValue(value: unknown, key = ""): unknown {
  if (TRACKER_PROMPT_METADATA_KEYS.has(key)) return undefined;
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const entries = value.map((entry) => trackerPromptValue(entry)).filter((entry) => entry !== undefined);
    return entries.length > 0 ? entries : undefined;
  }
  if (!isRecord(value)) return undefined;

  const next: JsonRecord = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const cleaned = trackerPromptValue(entryValue, entryKey);
    if (cleaned !== undefined) next[entryKey] = cleaned;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function trackerSection(key: string, label: string, value: unknown): TrackerPromptSection | null {
  const cleaned = trackerPromptValue(value);
  return cleaned === undefined ? null : { key, label, value: cleaned };
}

function pickTrackerFields(source: JsonRecord, keys: string[]): JsonRecord {
  const next: JsonRecord = {};
  for (const key of keys) {
    const cleaned = trackerPromptValue(source[key], key);
    if (cleaned !== undefined) next[key] = cleaned;
  }
  return next;
}

function trackerPromptSections(state: JsonRecord, activeIds: Set<string>): TrackerPromptSection[] {
  const playerStats = parseRecord(state.playerStats);
  const sections: Array<TrackerPromptSection | null> = [];

  if (activeIds.has("world-state")) {
    sections.push(
      trackerSection(
        "world_state",
        "World State",
        pickTrackerFields(state, ["date", "time", "location", "weather", "temperature", "recentEvents"]),
      ),
    );
  }

  if (activeIds.has("character-tracker")) {
    sections.push(trackerSection("character_tracker", "Character Tracker", state.presentCharacters));
  }

  const playerStatsCore = pickTrackerFields(playerStats, ["status", "stats", "attributes", "skills", "inventory"]);
  sections.push(trackerSection("player_stats", "Player Stats", playerStatsCore));

  if (activeIds.has("persona-stats")) {
    sections.push(trackerSection("persona_stats", "Persona Stats", state.personaStats));
  }

  if (activeIds.has("quest")) {
    sections.push(trackerSection("quest_tracker", "Quest Tracker", playerStats.activeQuests));
  }

  if (activeIds.has("custom-tracker")) {
    sections.push(trackerSection("custom_tracker", "Custom Tracker", playerStats.customTrackerFields));
  }

  const other = { ...state };
  for (const key of [
    "date",
    "time",
    "location",
    "weather",
    "temperature",
    "recentEvents",
    "presentCharacters",
    "playerStats",
    "personaStats",
  ]) {
    delete other[key];
  }
  sections.push(trackerSection("other_trackers", "Other Trackers", other));

  return sections.filter((section): section is TrackerPromptSection => section !== null);
}

function trackerSectionText(section: TrackerPromptSection): string {
  return trackerPromptText(section.value).slice(0, 2000);
}

function trackerPromptLabel(key: string): string {
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!label) return "Value";
  return label
    .split(" ")
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

function trackerScalarText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return null;
    if (/^[a-z][a-z\s/'",-]*$/.test(text)) return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    return text;
  }
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

function indentTrackerText(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join("\n");
}

function bulletTrackerText(text: string): string {
  const lines = text.split("\n");
  return lines.map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`)).join("\n");
}

function compactNamedTrackerRecord(record: JsonRecord): string | null {
  const keys = Object.keys(record);
  const name = trackerScalarText(record.name);
  if (!name || !keys.includes("name")) return null;

  const value = trackerScalarText(record.value);
  const max = trackerScalarText(record.max);
  if (value && max && keys.every((key) => key === "name" || key === "value" || key === "max")) {
    return `${name}: ${value} / ${max}`;
  }
  if (value && keys.every((key) => key === "name" || key === "value")) {
    return `${name}: ${value}`;
  }
  return null;
}

function trackerPromptText(value: unknown): string {
  const scalar = trackerScalarText(value);
  if (scalar) return scalar;

  if (Array.isArray(value)) {
    return value
      .map((entry) => trackerPromptText(entry).trim())
      .filter(Boolean)
      .map(bulletTrackerText)
      .join("\n");
  }

  if (!isRecord(value)) return "";
  const compact = compactNamedTrackerRecord(value);
  if (compact) return compact;

  return Object.entries(value)
    .map(([key, entryValue]) => {
      const text = trackerPromptText(entryValue).trim();
      if (!text) return "";
      const label = trackerPromptLabel(key);
      return text.includes("\n") ? `${label}:\n${indentTrackerText(text)}` : `${label}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

function formattedTrackersContent(sections: TrackerPromptSection[], wrapFormat: WrapFormat): string {
  if (sections.length === 0) return "";

  if (wrapFormat === "xml") {
    return sections
      .map((section) => wrapContent(trackerSectionText(section), section.key, "xml", 1))
      .filter(Boolean)
      .join("\n\n");
  }

  if (wrapFormat === "markdown") {
    return sections
      .map((section) => wrapContent(trackerSectionText(section), section.label, "markdown", 1))
      .filter(Boolean)
      .join("\n\n");
  }

  return ["Trackers", ...sections.map((section) => `${section.label}\n${trackerSectionText(section)}`)]
    .filter((part) => part.trim())
    .join("\n\n")
    .slice(0, 6000);
}

function committedTrackerStatePromptMessage(input: PromptAssemblyInput, wrapFormat: WrapFormat): ChatMLMessage | null {
  const meta = parseRecord(input.chat.metadata);
  const activeIds = new Set(activeTrackerAgentIds(meta));
  if (activeIds.size === 0) return null;

  const state = trackerPromptValue(input.chat.gameState ?? meta.gameState);
  if (!isRecord(state) || Object.keys(state).length === 0) return null;

  const content = formattedTrackersContent(trackerPromptSections(state, activeIds), wrapFormat);
  if (!content.trim()) return null;
  return {
    role: "user",
    content,
    contextKind: "injection",
    displayName: "Trackers",
  };
}

function conversationCharacterNames(characters: GenerationCharacterContext[]): string[] {
  return characters.map((character) => character.name.trim()).filter(Boolean);
}

function resolveConversationSystemPrompt(
  template: string,
  macros: MacroContext,
  characters: GenerationCharacterContext[],
): string {
  const names = conversationCharacterNames(characters);
  if (names.length <= 1) return resolveMacros(template, macros);
  const characterList = names.join(", ");
  const groupTemplate = template
    .replace(/\{\{charName\}\}/gi, characterList)
    .replace(/\{\{characters\}\}/gi, characterList);
  return resolveMacros(groupTemplate, macros);
}

function groupConversationReplyGuidance(input: PromptAssemblyInput, characters: GenerationCharacterContext[]): string {
  const names = conversationCharacterNames(characters);
  if (names.length <= 1) return "";
  const metadata = parseRecord(input.chat.metadata);
  if (readString(metadata.groupResponseOrder, "sequential") === "manual") {
    return [
      "This is a group DM. Each character responds in their own voice and personality.",
      "You will be told which character to respond as. Do NOT prefix your message with the character name - just respond naturally as that character.",
    ].join("\n");
  }

  const first = names[0] ?? "Alice";
  const second = names[1] ?? "Bob";
  return [
    "This is a group DM. Each character responds in their own voice and personality. Not every character needs to respond every time - only those who would naturally react.",
    "IMPORTANT: Prefix each character's line with their name. Example:",
    `${first}: hey whats up`,
    `${second}: not much lol`,
    "",
    "If a character sends multiple lines in a row, only prefix the first line:",
    `${first}: so anyway`,
    "i was thinking about that",
    `${second}: yeah?`,
  ].join("\n");
}

function fallbackSystemPrompt(
  input: PromptAssemblyInput,
  args: {
    characters: GenerationCharacterContext[];
    conversationCharacters: GenerationCharacterContext[];
    persona: GenerationPersonaContext | null;
    worldBefore: string;
    worldAfter: string;
    summary: string | null;
    wrapFormat: WrapFormat;
    macros: MacroContext;
    groupScenarioOverride: GroupScenarioOverride;
  },
): string {
  const mode = readString(input.chat.mode || input.chat.chatMode, "conversation");
  const meta = parseRecord(input.chat.metadata);
  const common = [
    renderCharacters(args.characters, args.wrapFormat, null, args.macros, args.groupScenarioOverride),
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

  const groupConversation = conversationCharacterNames(args.conversationCharacters).length > 1;
  const defaultConversationPrompt = groupConversation
    ? DEFAULT_GROUP_CONVERSATION_SYSTEM_PROMPT
    : DEFAULT_CONVERSATION_SYSTEM_PROMPT;
  const rawConversationPrompt = readString(meta.customSystemPrompt).trim() || defaultConversationPrompt;
  const conversationPrompt = cleanPromptText(
    resolveConversationSystemPrompt(rawConversationPrompt, args.macros, args.conversationCharacters),
  );
  return [conversationPrompt, groupConversationReplyGuidance(input, args.conversationCharacters), ...common]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}

function shouldForceRoleplaySummaryIntoSystem(chat: JsonRecord): boolean {
  const meta = parseRecord(chat.metadata);
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  return mode === "roleplay" || meta.sceneStatus === "active";
}

function shouldFallbackInsertChatSummary(
  chat: JsonRecord,
  selectedPreset: SelectedPromptPreset | null,
  summary: string | null,
): boolean {
  if (!selectedPreset || !summary?.trim()) return false;
  if (presetCanInsertChatSummary(selectedPreset, summary)) return false;
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  return mode === "conversation" || shouldForceRoleplaySummaryIntoSystem(chat);
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

function buildRoleplayNarratorStylePromptBlock(chat: JsonRecord, wrapFormat: WrapFormat): string | null {
  if (readString(chat.mode || chat.chatMode) !== "roleplay") return null;
  const style = readString(parseRecord(chat.metadata).narratorStyleInstructions).trim().slice(0, 2000);
  if (!style) return null;
  return wrapContent(
    [
      "Use these narrator style instructions for narration and descriptive prose in this chat.",
      "Do not treat them as character facts, player persona facts, or world lore.",
      style,
    ].join("\n\n"),
    "narrator_style",
    wrapFormat,
  );
}

export function chatSummaryForGeneration(chat: JsonRecord): string | null {
  const meta = parseRecord(chat.metadata);
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  const includeSceneSummary = mode !== "conversation" || meta.crossChatAwareness !== false;
  const rollingSummary = normalizeChatSummaryMetadata(meta).summary;
  const parts = [
    meta.conversationSummary,
    rollingSummary,
    formatSummaryMap("Day", meta.daySummaries),
    formatSummaryMap("Week", meta.weekSummaries),
    includeSceneSummary ? meta.lastRoleplaySceneSummary : null,
  ]
    .map((value) =>
      typeof value === "string" ? value : isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : "",
    )
    .filter((value) => value.trim().length > 0);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function formatSummaryEntry(label: string, key: string, value: unknown): string {
  const entry = parseRecord(value);
  const summary = readString(entry.summary).trim();
  const keyDetails = stringArray(entry.keyDetails);
  if (!summary && keyDetails.length === 0) return "";
  const parts = [`${label} summary ${key}`];
  if (summary) parts.push(summary);
  if (keyDetails.length > 0) {
    parts.push(["Key details:", ...keyDetails.map((detail) => `- ${detail}`)].join("\n"));
  }
  return parts.filter(Boolean).join("\n");
}

function formatSummaryMap(label: "Day" | "Week", value: unknown): string {
  const entries = Object.entries(parseRecord(value))
    .map(([key, entry]) => ({ key, text: formatSummaryEntry(label, key, entry) }))
    .filter((entry) => entry.text.trim().length > 0)
    .sort((a, b) => compareSummaryKeys(a.key, b.key));
  return entries.map((entry) => entry.text).join("\n\n");
}

function summaryKeyTimestamp(key: string): number | null {
  const dotted = key.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = Date.parse(key);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareSummaryKeys(a: string, b: string): number {
  const aTime = summaryKeyTimestamp(a);
  const bTime = summaryKeyTimestamp(b);
  if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
  return a.localeCompare(b);
}

function hasConversationSummaryCompaction(meta: JsonRecord): boolean {
  return !!formatSummaryMap("Day", meta.daySummaries).trim() || !!formatSummaryMap("Week", meta.weekSummaries).trim();
}

function presetCanInsertChatSummary(preset: SelectedPromptPreset | null, summary: string | null): boolean {
  if (!preset || !summary?.trim()) return false;
  return preset.sections.some(
    (section) => boolish(section.enabled, true) && markerConfig(section)?.type === "chat_summary",
  );
}

function shouldCompactHistoryForSummary(
  chat: JsonRecord,
  selectedPreset: SelectedPromptPreset | null,
  summary: string | null,
): boolean {
  if (!summary?.trim()) return false;
  const meta = parseRecord(chat.metadata);
  if (!hasConversationSummaryCompaction(meta)) return false;
  if (!selectedPreset) return true;
  return (
    presetCanInsertChatSummary(selectedPreset, summary) ||
    shouldFallbackInsertChatSummary(chat, selectedPreset, summary)
  );
}

function compactedHistoryLimit(meta: JsonRecord, fallbackLimit: number, shouldCompact: boolean): number {
  if (!shouldCompact) return fallbackLimit;
  const tail = Math.max(0, Math.min(50, Math.floor(readNumber(meta.summaryTailMessages, 10))));
  return Math.min(fallbackLimit, tail);
}

const MEMORY_EMBEDDING_DIMS = 512;
const DEFAULT_MEMORY_RECALL_BUDGET_TOKENS = 1024;
const MIN_MEMORY_RECALL_BUDGET_TOKENS = 256;
const MAX_MEMORY_RECALL_BUDGET_TOKENS = 2048;
const MAX_RECALLED_MEMORY_TOKENS = 384;
const MIN_RECALLED_MEMORY_TOKENS = 96;
const MEMORY_RECALL_CONTEXT_SHARE = 0.15;
const MEMORY_RECALL_SIMILARITY_THRESHOLD = 0.25;
const MAX_MEMORY_RECALL_SCORING_CHUNKS = 500;
const MIN_MEMORY_RECALL_MULTI_TOKEN_STRONG_LEXICAL_TOKENS = 2;
const MIN_MEMORY_RECALL_STRONG_LEXICAL_COVERAGE = 0.75;
const DEFAULT_MEMORY_RECALL_READ_BEHIND_MESSAGES = 1;
const MAX_MEMORY_RECALL_READ_BEHIND_MESSAGES = 100;
const RECALL_TRUNCATION_MARKER = "\n...[recalled memory truncated]...\n";
const MEMORY_RECALL_QUERY_STOPWORDS = new Set([
  "about",
  "and",
  "are",
  "been",
  "but",
  "did",
  "does",
  "find",
  "for",
  "from",
  "had",
  "has",
  "have",
  "her",
  "him",
  "his",
  "how",
  "its",
  "know",
  "our",
  "recall",
  "remember",
  "she",
  "show",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

function estimateTextTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed ? Math.max(1, Math.ceil(trimmed.length / 4)) : 0;
}

function lexicalMemoryTokens(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(/[\p{Letter}\p{Number}]{2,}/gu), (match) => match[0]);
}

function lexicalFeatureHash(feature: string): number {
  let hash = 2166136261;
  for (const char of Array.from(feature)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function addLexicalFeature(vector: number[], feature: string, weight: number): void {
  if (!feature || weight <= 0) return;
  const hash = lexicalFeatureHash(feature);
  const sign = (hash & 0x80000000) === 0 ? 1 : -1;
  vector[hash % MEMORY_EMBEDDING_DIMS] += weight * sign;
}

function tokenCharLength(token: string): number {
  return Array.from(token).length;
}

function memoryRecallMeaningfulToken(token: string): boolean {
  return !MEMORY_RECALL_QUERY_STOPWORDS.has(token);
}

function memoryRecallTokenWeight(token: string): number {
  if (!memoryRecallMeaningfulToken(token)) return 0;
  return 1 + Math.min(0.75, Math.max(0, tokenCharLength(token) - 4) * 0.05);
}

function addMemoryRecallTokenFeatures(vector: number[], token: string): void {
  const weight = memoryRecallTokenWeight(token);
  if (weight <= 0) return;
  const chars = Array.from(token);
  addLexicalFeature(vector, `w:${token}`, weight);
  if (chars.length >= 5) {
    addLexicalFeature(vector, `p:${chars.slice(0, 4).join("")}`, 0.25);
    addLexicalFeature(vector, `s:${chars.slice(-4).join("")}`, 0.25);
  }
  for (let index = 0; index + 3 <= chars.length; index += 1) {
    addLexicalFeature(vector, `g:${chars.slice(index, index + 3).join("")}`, 0.15);
  }
}

function lexicalMemoryEmbedding(text: string): number[] {
  const vector = Array.from({ length: MEMORY_EMBEDDING_DIMS }, () => 0);
  const meaningfulTokens: string[] = [];
  for (const token of lexicalMemoryTokens(text)) {
    addMemoryRecallTokenFeatures(vector, token);
    if (memoryRecallMeaningfulToken(token)) meaningfulTokens.push(token);
  }
  for (let index = 0; index + 1 < meaningfulTokens.length; index += 1) {
    addLexicalFeature(vector, `b:${meaningfulTokens[index]} ${meaningfulTokens[index + 1]}`, 1.4);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector;
}

function memoryRecallTokenSet(text: string): Set<string> {
  return new Set(lexicalMemoryTokens(text));
}

function memoryRecallQueryTokens(text: string): string[] {
  return Array.from(memoryRecallTokenSet(text)).filter(memoryRecallMeaningfulToken);
}

function memoryRecallLexicalOverlap(queryTokens: string[], contentTokens: Set<string>): number {
  return queryTokens.reduce((score, token) => score + (contentTokens.has(token) ? 1 : 0), 0);
}

function hasStrongMemoryRecallLexicalMatch(queryTokenCount: number, lexicalScore: number): boolean {
  if (queryTokenCount === 1) return lexicalScore >= 1;
  if (queryTokenCount < MIN_MEMORY_RECALL_MULTI_TOKEN_STRONG_LEXICAL_TOKENS) return false;
  if (lexicalScore < MIN_MEMORY_RECALL_MULTI_TOKEN_STRONG_LEXICAL_TOKENS) return false;
  return lexicalScore / queryTokenCount >= MIN_MEMORY_RECALL_STRONG_LEXICAL_COVERAGE;
}

function passesMemoryRecallRelevanceFloor(similarity: number, queryTokenCount: number, lexicalScore: number): boolean {
  return (
    similarity >= MEMORY_RECALL_SIMILARITY_THRESHOLD || hasStrongMemoryRecallLexicalMatch(queryTokenCount, lexicalScore)
  );
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

function memoryRecallReadBehind(chat: JsonRecord): number {
  const meta = parseRecord(chat.metadata);
  const raw = readNumber(meta.memoryRecallReadBehindMessages, DEFAULT_MEMORY_RECALL_READ_BEHIND_MESSAGES);
  if (!Number.isFinite(raw)) return DEFAULT_MEMORY_RECALL_READ_BEHIND_MESSAGES;
  return Math.max(0, Math.min(MAX_MEMORY_RECALL_READ_BEHIND_MESSAGES, Math.trunc(raw)));
}

function memoryRecallEligibleMessages(messages: JsonRecord[]): JsonRecord[] {
  return messages.filter((message) => !hiddenFromAi(message) && !!readString(message.content).trim());
}

function recentMemoryRecallMessages(messages: JsonRecord[], readBehind: number): JsonRecord[] {
  if (readBehind <= 0) return [];
  return memoryRecallEligibleMessages(messages).slice(-readBehind);
}

function messageIdSet(messages: JsonRecord[]): Set<string> {
  return new Set(messages.map((message) => readString(message.id).trim()).filter(Boolean));
}

function memoryRecallReadBehindExclusion(
  chat: JsonRecord,
  storedMessages: JsonRecord[],
): Pick<ListChatMemoriesOptions, "excludeRecentMessageIds" | "excludeRecentStartAt"> {
  const readBehind = memoryRecallReadBehind(chat);
  if (readBehind <= 0) return {};

  const recentMessages = recentMemoryRecallMessages(storedMessages, readBehind);
  const excludeRecentMessageIds = Array.from(messageIdSet(recentMessages));
  if (excludeRecentMessageIds.length === 0) return {};

  const excludeRecentStartAt = readString(recentMessages[0]?.createdAt).trim();
  return {
    excludeRecentMessageIds,
    ...(excludeRecentStartAt ? { excludeRecentStartAt } : {}),
  };
}

function memoryChunkMessageIds(memory: JsonRecord): Set<string> {
  const ids = new Set<string>();
  for (const value of Array.isArray(memory.messageIds) ? memory.messageIds : []) {
    const id = readString(value).trim();
    if (id) ids.add(id);
  }
  for (const value of [memory.firstMessageId, memory.lastMessageId]) {
    const id = readString(value).trim();
    if (id) ids.add(id);
  }
  return ids;
}

function memoryOverlapsRecentMessages(memory: JsonRecord, recentIds: Set<string>, recentStartAt: string): boolean {
  if (recentIds.size === 0) return false;
  const chunkIds = memoryChunkMessageIds(memory);
  if (chunkIds.size > 0) {
    for (const id of chunkIds) {
      if (recentIds.has(id)) return true;
    }
    return false;
  }

  const lastMessageAt = readString(memory.lastMessageAt).trim();
  return !!lastMessageAt && !!recentStartAt && lastMessageAt >= recentStartAt;
}

function memoriesAfterReadBehind(chat: JsonRecord, storedMessages: JsonRecord[], memories: JsonRecord[]): JsonRecord[] {
  const readBehind = memoryRecallReadBehind(chat);
  if (readBehind <= 0 || memories.length === 0) return memories;

  const recentMessages = recentMemoryRecallMessages(storedMessages, readBehind);
  const recentIds = messageIdSet(recentMessages);
  const recentStartAt = readString(recentMessages[0]?.createdAt).trim();
  return memories.filter((memory) => !memoryOverlapsRecentMessages(memory, recentIds, recentStartAt));
}

function memoryRecallRecencyKey(memory: JsonRecord): string {
  return (
    readString(memory.lastMessageAt).trim() ||
    readString(memory.createdAt).trim() ||
    readString(memory.firstMessageAt).trim()
  );
}

function recentMemoryRecallScoringSet(memories: JsonRecord[]): JsonRecord[] {
  if (memories.length <= MAX_MEMORY_RECALL_SCORING_CHUNKS) return memories;
  return [...memories]
    .sort((a, b) => memoryRecallRecencyKey(b).localeCompare(memoryRecallRecencyKey(a)))
    .slice(0, MAX_MEMORY_RECALL_SCORING_CHUNKS);
}

function memoryRecallRows(value: unknown): JsonRecord[] {
  return parseArray(value).filter(isRecord);
}

async function buildMemoryRecallBlock(
  storage: StorageGateway,
  chat: JsonRecord,
  storedMessages: JsonRecord[],
  latestUserInput: string,
  maxContext?: number,
  embeddingSource?: { embed(texts: string[]): Promise<number[][] | null> } | null,
): Promise<string | null> {
  if (!memoryRecallEnabled(chat) || !latestUserInput.trim()) return null;
  const chatId = readString(chat.id).trim();
  if (!chatId) return null;
  let memories: JsonRecord[] = [];
  try {
    const rows = await storage.listChatMemories<unknown>(chatId, {
      limit: MAX_MEMORY_RECALL_SCORING_CHUNKS,
      order: "recent",
      ...memoryRecallReadBehindExclusion(chat, storedMessages),
    });
    memories = memoryRecallRows(rows);
  } catch {
    memories = memoryRecallRows(chat.memories);
  }
  memories = recentMemoryRecallScoringSet(memoriesAfterReadBehind(chat, storedMessages, memories));
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
  const queryTokens = memoryRecallQueryTokens(latestUserInput);
  const recalled = memories
    .map((memory) => {
      const content = readString(memory.content).trim();
      if (!content) return null;
      const providerVector = semanticQueryVector ? memoryVector(memory, semanticQueryVector.length) : null;
      const vector = providerVector ?? memoryVector(memory, MEMORY_EMBEDDING_DIMS) ?? lexicalMemoryEmbedding(content);
      const baseQueryVector = providerVector && semanticQueryVector ? semanticQueryVector : queryVector;
      const lexicalScore = memoryRecallLexicalOverlap(queryTokens, memoryRecallTokenSet(content));
      const similarity = cosineSimilarity(baseQueryVector, vector) + Math.min(0.2, lexicalScore * 0.025);
      return { content, similarity, lexicalScore };
    })
    .filter(
      (memory): memory is { content: string; similarity: number; lexicalScore: number } =>
        !!memory && passesMemoryRecallRelevanceFloor(memory.similarity, queryTokens.length, memory.lexicalScore),
    )
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

function memoizedEmbeddingSource(
  source: PromptAssemblyInput["embeddingSource"],
): PromptAssemblyInput["embeddingSource"] {
  if (!source) return null;
  const cache = new Map<string, Promise<number[][] | null>>();
  return {
    embed: (texts, request) => {
      const key = JSON.stringify([texts, request ?? null]);
      const existing = cache.get(key);
      if (existing) return existing;
      const embedding = source.embed(texts, request);
      cache.set(key, embedding);
      return embedding;
    },
  };
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

function characterNameLookup(characters: GenerationCharacterContext[]): Map<string, string> {
  return new Map(characters.map((character) => [character.id, character.name]));
}

function promptSnippet(value: unknown, limit = 900): string {
  const text = collapseExcessBlankLines(readString(value)).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
}

function modeOf(chat: JsonRecord | null | undefined): string {
  return readString(chat?.mode || chat?.chatMode, "conversation");
}

function historyLine(message: JsonRecord, characterNames: Map<string, string>): string {
  const role = readString(message.role, "message");
  const characterId = readString(message.characterId).trim();
  const name =
    readString(message.name || message.displayName || message.characterName).trim() ||
    (characterId ? characterNames.get(characterId) : "") ||
    role;
  return `${name}: ${promptSnippet(message.content, 700)}`;
}

function recentVisibleMessageLines(messages: JsonRecord[], characterNames: Map<string, string>, limit = 6): string[] {
  return messages
    .filter((message) => !hiddenFromAi(message) && readString(message.content).trim())
    .slice(-limit)
    .map((message) => historyLine(message, characterNames));
}

function buildConversationPresenceBlock(input: PromptAssemblyInput, wrapFormat: WrapFormat): ChatMLMessage | null {
  const chatMode = modeOf(input.chat);
  if (chatMode !== "conversation") return null;
  const status = readString(input.request.userStatus).trim();
  const activity = readString(input.request.userActivity).trim();
  const timeZone = resolvePromptTimeZone(input.chat, input.request);
  const now = new Date();
  const parts = [
    status ? `User status: ${status}` : "",
    activity ? `User activity: ${activity}` : "",
    `Current date: ${formatZonedDate(now, timeZone)}`,
    `Current time: ${formatZonedTime(now, timeZone)}`,
    `Current weekday: ${getZonedWeekdayName(now, timeZone)}`,
    timeZone ? `Time zone: ${timeZone}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return {
    role: "system",
    contextKind: "prompt",
    content: wrapContent(
      [
        "Use this live conversation presence context to judge availability, timing, and whether proactive or casual replies make sense.",
        ...parts,
      ].join("\n"),
      "conversation_presence",
      wrapFormat,
    ),
  };
}

function scheduleLine(block: JsonRecord): string {
  const time = readString(block.time).trim();
  const status = readString(block.status).trim();
  const activity = readString(block.activity).trim();
  const prefix = [time, status].filter(Boolean).join(" ");
  if (!prefix) return activity;
  return activity ? `${prefix} - ${activity}` : prefix;
}

function buildConversationScheduleBlock(
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  wrapFormat: WrapFormat,
): ChatMLMessage | null {
  if (modeOf(chat) !== "conversation") return null;
  const meta = parseRecord(chat.metadata);
  const schedules = parseRecord(meta.characterSchedules);
  if (!boolish(meta.conversationSchedulesEnabled, Object.keys(schedules).length > 0)) return null;
  const names = characterNameLookup(characters);
  const sections: string[] = [];
  for (const characterId of activeCharacterIds(chat)) {
    const schedule = parseRecord(schedules[characterId]);
    const days = parseRecord(schedule.days);
    const lines = Object.entries(days).flatMap(([day, rawBlocks]) => {
      const blocks = parseArray(rawBlocks)
        .filter(isRecord)
        .map(scheduleLine)
        .filter((line) => line.trim());
      return blocks.length > 0 ? [`${day}:`, ...blocks.map((line) => `- ${line}`)] : [];
    });
    if (lines.length === 0) continue;
    sections.push([names.get(characterId) ?? characterId, ...lines.slice(0, 28)].join("\n"));
  }
  if (sections.length === 0) return null;
  return {
    role: "system",
    contextKind: "prompt",
    content: wrapContent(
      [
        "Generated weekly availability for conversation characters. Use it as soft context for whether a character is available, busy, or likely to reply.",
        sections.join("\n\n"),
      ].join("\n\n"),
      "character_schedules",
      wrapFormat,
    ),
  };
}

function sharesConversationCharacter(source: JsonRecord, candidate: JsonRecord): boolean {
  const sourceIds = new Set(activeCharacterIds(source));
  if (sourceIds.size === 0) return false;
  return activeCharacterIds(candidate).some((id) => sourceIds.has(id));
}

const CROSS_CHAT_SIBLING_SCAN_LIMIT = 24;

function chatRecencyMs(chat: JsonRecord): number {
  const raw =
    readString(chat.lastActivityAt).trim() ||
    readString(chat.updatedAt).trim() ||
    readString(chat.lastMessageAt).trim() ||
    readString(chat.createdAt).trim();
  const time = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

async function buildCrossChatAwarenessBlock(
  storage: StorageGateway,
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  wrapFormat: WrapFormat,
): Promise<ChatMLMessage | null> {
  if (modeOf(chat) !== "conversation") return null;
  const meta = parseRecord(chat.metadata);
  if (!boolish(meta.crossChatAwareness, false)) return null;
  const chatId = readString(chat.id).trim();
  if (!chatId) return null;
  const characterNames = characterNameLookup(characters);
  const chats = await storage.list<JsonRecord>("chats").catch(() => []);
  const siblingChats = chats
    .filter((candidate) => readString(candidate.id).trim() !== chatId)
    .filter((candidate) => modeOf(candidate) === "conversation")
    .filter((candidate) => sharesConversationCharacter(chat, candidate))
    .sort((left, right) => chatRecencyMs(right) - chatRecencyMs(left))
    .slice(0, CROSS_CHAT_SIBLING_SCAN_LIMIT);
  const sections: string[] = [];
  for (const sibling of siblingChats) {
    if (sections.length >= 6) break;
    const siblingId = readString(sibling.id).trim();
    if (!siblingId) continue;
    const lines = recentVisibleMessageLines(
      await storage.listChatMessages<JsonRecord>(siblingId, { limit: 8 }).catch(() => []),
      characterNames,
      4,
    );
    if (lines.length === 0) continue;
    const title = readString(sibling.name).trim() || siblingId;
    sections.push([`Chat: ${title}`, ...lines.map((line) => `- ${line}`)].join("\n"));
  }
  if (sections.length === 0) return null;
  return {
    role: "system",
    contextKind: "prompt",
    content: wrapContent(
      [
        "Recent sibling conversation context for shared characters. Use it for continuity only; do not quote it as a system artifact.",
        sections.join("\n\n"),
      ].join("\n\n"),
      "cross_chat_awareness",
      wrapFormat,
    ),
  };
}

function connectedSummaryLines(chat: JsonRecord): string[] {
  const meta = parseRecord(chat.metadata);
  const mode = modeOf(chat);
  const summaryValues = [
    meta.conversationSummary,
    meta.summary,
    meta.lastRoleplaySceneSummary,
    meta.sceneDescription,
    meta.sceneScenario,
  ]
    .map((value) => promptSnippet(value, 900))
    .filter(Boolean);
  const gameState = mode === "game" ? parseRecord(chat.gameState ?? meta.gameState) : {};
  return [
    ...summaryValues.map((summary) => `Summary: ${summary}`),
    Object.keys(gameState).length > 0 ? `Game state: ${JSON.stringify(gameState).slice(0, 1800)}` : "",
  ].filter(Boolean);
}

async function buildConversationLinkedChatBlock(
  storage: StorageGateway,
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  wrapFormat: WrapFormat,
): Promise<{ block: ChatMLMessage | null; connectedMode: string | null }> {
  if (modeOf(chat) !== "conversation") return { block: null, connectedMode: null };
  const connectedChatId = readString(chat.connectedChatId).trim();
  if (!connectedChatId) return { block: null, connectedMode: null };
  const connected = await storage.get<JsonRecord>("chats", connectedChatId).catch(() => null);
  const connectedMode = modeOf(connected);
  if (!connected || (connectedMode !== "roleplay" && connectedMode !== "game")) {
    return { block: null, connectedMode: null };
  }
  const characterNames = characterNameLookup(characters);
  const recentLines = recentVisibleMessageLines(
    await storage.listChatMessages<JsonRecord>(connectedChatId, { limit: 10 }).catch(() => []),
    characterNames,
    6,
  );
  const title = readString(connected.name).trim() || connectedChatId;
  const lines = [
    `Linked ${connectedMode}: ${title}`,
    ...connectedSummaryLines(connected),
    ...(recentLines.length > 0 ? ["Recent linked messages:", ...recentLines.map((line) => `- ${line}`)] : []),
  ].filter(Boolean);
  if (lines.length <= 1) return { block: null, connectedMode };
  return {
    connectedMode,
    block: {
      role: "system",
      contextKind: "prompt",
      content: wrapContent(
        [
          `This conversation is linked to a ${connectedMode} chat. Use the linked context when the user or character refers to that shared situation, without turning the conversation reply into a full ${connectedMode} turn unless asked.`,
          lines.join("\n"),
        ].join("\n\n"),
        connectedMode === "game" ? "connected_game" : "connected_roleplay",
        wrapFormat,
      ),
    },
  };
}

function conversationCommandCapabilities(chat: JsonRecord, meta: JsonRecord): JsonRecord {
  return {
    ...parseRecord(meta.commandCapabilities),
    ...parseRecord(meta.capabilities),
    ...parseRecord(chat.capabilities),
  };
}

function commandCapabilityEnabled(capabilities: JsonRecord, keys: string[], fallback = true): boolean {
  for (const key of keys) {
    if (capabilities[key] === false) return false;
    if (capabilities[key] === true) return true;
  }
  return fallback;
}

function buildConversationCommandBlock(
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  connectedMode: string | null,
  wrapFormat: WrapFormat,
): ChatMLMessage | null {
  if (modeOf(chat) !== "conversation") return null;
  const meta = parseRecord(chat.metadata);
  if (!boolish(meta.characterCommands, false)) return null;
  const capabilities = conversationCommandCapabilities(chat, meta);
  const schedules = parseRecord(meta.characterSchedules);
  const hasSchedules =
    boolish(meta.conversationSchedulesEnabled, Object.keys(schedules).length > 0) &&
    commandCapabilityEnabled(capabilities, ["scheduleUpdate", "canScheduleUpdate", "canUpdateSchedule"]);
  const hasCharacters = characters.length > 0;
  const hasConnectedRoleplayOrGame = connectedMode === "roleplay" || connectedMode === "game";
  const canCrossPost = commandCapabilityEnabled(capabilities, ["crossPost", "canCrossPost"]);
  const canSelfie = commandCapabilityEnabled(capabilities, [
    "selfie",
    "canSelfie",
    "imageGeneration",
    "canGenerateImages",
  ]);
  const canMemory = commandCapabilityEnabled(capabilities, ["memory", "canSaveMemory"]);
  const canStartScene = commandCapabilityEnabled(capabilities, ["scene", "canStartScene", "canStartScenes"]);
  const instructions = [
    "When useful, append one hidden command tag after the visible reply. Hidden tags are parsed by Marinara and stripped before the user sees the message. Never describe the tag in visible prose.",
    hasSchedules
      ? '- Update availability with [schedule_update: status="online|idle|dnd|offline", activity="short activity"] when the character is correcting their current status or plans.'
      : "",
    canCrossPost
      ? '- Cross-post a message with [cross_post: target="group or chat name"] when the character naturally wants to move or share a message across conversations.'
      : "",
    canSelfie
      ? '- Request an image with [selfie] or [selfie: context="brief visual context"] when a casual conversation selfie is appropriate and image generation is configured.'
      : "",
    hasCharacters && canMemory
      ? '- Save a durable character memory with [memory: target="Character Name", summary="brief memory"] when the character learns something they should remember later.'
      : "",
    canStartScene
      ? '- Start a linked roleplay scene with [scene: scenario="what happens", background="optional setting", plan="optional short plan"] when the conversation clearly calls for a scene.'
      : "",
    hasConnectedRoleplayOrGame
      ? "- Send linked-chat context with <influence>one-shot OOC steering note</influence> or <note>durable fact for the linked prompt</note> when this conversation should affect the linked roleplay/game."
      : "",
  ].filter(Boolean);
  if (instructions.length <= 1) return null;
  return {
    role: "system",
    contextKind: "prompt",
    content: wrapContent(instructions.join("\n"), "conversation_commands", wrapFormat),
  };
}

async function buildConversationContextBlocks(
  storage: StorageGateway,
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
  wrapFormat: WrapFormat,
): Promise<ChatMLMessage[]> {
  if (modeOf(input.chat) !== "conversation") return [];
  const linked = await buildConversationLinkedChatBlock(storage, input.chat, characters, wrapFormat);
  return [
    buildConversationPresenceBlock(input, wrapFormat),
    buildConversationScheduleBlock(input.chat, characters, wrapFormat),
    await buildCrossChatAwarenessBlock(storage, input.chat, characters, wrapFormat),
    linked.block,
    buildConversationCommandBlock(input.chat, characters, linked.connectedMode, wrapFormat),
  ].filter((block): block is ChatMLMessage => block !== null);
}

function buildRoleplayDirectMessageCommandReminder(chat: JsonRecord): ChatMLMessage[] {
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  const meta = parseRecord(chat.metadata);
  if (mode !== "roleplay" || !boolish(meta.roleplayDmCommandsEnabled, false)) return [];
  return [
    {
      role: "system",
      contextKind: "prompt",
      content: [
        "<direct_message_commands>",
        'If a roleplay character naturally texts or privately messages the user outside the current scene, append one hidden command after the visible response: [dm: character="Character Name" message="Message text"].',
        "Use the exact character name and only use this for in-world private messages, not normal spoken dialogue or narration.",
        "Do not mention the command in visible text.",
        "</direct_message_commands>",
      ].join("\n"),
    },
  ];
}

function insertBeforeLastUser(messages: ChatMLMessage[], blocks: ChatMLMessage[]): void {
  if (blocks.length === 0) return;
  const insertAt = messages.map((message) => message.role).lastIndexOf("user");
  messages.splice(insertAt >= 0 ? insertAt : messages.length, 0, ...blocks);
}

function insertAfterLastHistoryUser(messages: ChatMLMessage[], block: ChatMLMessage): void {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.contextKind === "history" && message.role === "user") {
      messages.splice(index + 1, 0, block);
      return;
    }
  }

  const lastHistoryIndex = messages.map((message) => message.contextKind).lastIndexOf("history");
  messages.splice(lastHistoryIndex >= 0 ? lastHistoryIndex + 1 : messages.length, 0, block);
}

function normalizeRole(value: unknown): "system" | "user" | "assistant" {
  return value === "system" || value === "assistant" ? value : "user";
}

function messageStoredReasoning(message: JsonRecord): string {
  const extra = parseRecord(message.extra);
  const thinking = readString(extra.thinking ?? extra.reasoning ?? extra.reasoning_content).trim();
  return thinking;
}

function messageProviderMetadata(message: JsonRecord): Record<string, unknown> | undefined {
  const extra = parseRecord(message.extra);
  const metadata = parseRecord(extra.providerMetadata ?? extra.provider_metadata);
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function historyMessageContent(message: JsonRecord, includePastReasoning: boolean): string {
  const content = collapseExcessBlankLines(readString(message.content).trim());
  if (!includePastReasoning || readString(message.role) !== "assistant") return content;
  const thinking = messageStoredReasoning(message);
  if (!thinking) return content;
  return `${content}\n\n<provider_reasoning>\n${thinking}\n</provider_reasoning>`;
}

function historyMessages(storedMessages: JsonRecord[], limit: number, includePastReasoning = false): ChatMLMessage[] {
  if (limit <= 0) return [];
  let conversationStartIndex = 0;
  for (let index = storedMessages.length - 1; index >= 0; index -= 1) {
    if (boolish(parseRecord(storedMessages[index]!.extra).isConversationStart, false)) {
      conversationStartIndex = index;
      break;
    }
  }
  const scopedMessages = conversationStartIndex > 0 ? storedMessages.slice(conversationStartIndex) : storedMessages;
  return scopedMessages
    .filter((message) => !hiddenFromAi(message))
    .slice(-limit)
    .map((message) => {
      const role = normalizeRole(message.role);
      const providerMetadata = role === "assistant" ? messageProviderMetadata(message) : undefined;
      return {
        role,
        content: historyMessageContent(message, includePastReasoning),
        contextKind: "history" as const,
        characterId: readString(message.characterId).trim() || undefined,
        name: readString(message.name).trim() || undefined,
        ...(providerMetadata ? { providerMetadata } : {}),
      };
    })
    .filter((message) => message.content.length > 0);
}

function leadingGreetingContents(storedMessages: JsonRecord[]): string[] {
  const contents: string[] = [];
  for (const message of storedMessages) {
    const role = normalizeRole(message.role);
    if (role === "user") break;
    if (role !== "assistant" || hiddenFromAi(message)) continue;
    const content = historyMessageContent(message, false).trim();
    if (content) contents.push(content);
  }
  return contents;
}

async function seedPromptVariablesFromGreeting(
  storage: StorageGateway,
  input: PromptAssemblyInput,
  macros: MacroContext,
  deferCharacterMacros: boolean,
): Promise<Record<string, string>> {
  const greetingContents = leadingGreetingContents(input.storedMessages);
  if (greetingContents.length === 0) return {};

  const persistedVariables = chatPromptVariables(input.chat);
  const before = { ...macros.variables };
  for (const content of greetingContents) {
    resolvePromptMacros(content, macros, deferCharacterMacros);
  }

  for (const [name, value] of Object.entries(persistedVariables)) {
    macros.variables[name] = value;
  }

  const discovered: Record<string, string> = {};
  for (const [name, value] of Object.entries(macros.variables)) {
    if (persistedVariables[name] !== undefined) continue;
    if (before[name] === value) continue;
    discovered[name] = value;
  }

  if (!input.persistPromptVariables || Object.keys(discovered).length === 0) return discovered;

  const chatId = readString(input.chat.id).trim();
  if (!chatId) return discovered;

  const promptVariables = {
    ...stringRecord(input.chat.promptVariables),
    ...discovered,
  };
  const variableValues = {
    ...stringRecord(input.chat.variableValues),
    ...discovered,
  };

  await storage.update("chats", chatId, {
    promptVariables,
    variableValues,
  });
  input.chat.promptVariables = promptVariables;
  input.chat.variableValues = variableValues;

  return discovered;
}

function applyReusableGreetingPromptVariables(macros: MacroContext, variables: Record<string, string>): void {
  for (const [name, value] of Object.entries(variables)) {
    macros.variables[name] = value;
  }
}

function shouldMergeSameRolePromptMessage(
  previous: ChatMLMessage | undefined,
  message: ChatMLMessage,
  effectiveRole: "user" | "assistant",
): previous is ChatMLMessage {
  if (!previous || previous.role !== effectiveRole) return false;
  return canMergePromptMessages(previous, { ...message, role: effectiveRole });
}

function mergeIntoPreviousPromptMessage(previous: ChatMLMessage, message: ChatMLMessage): void {
  previous.content += "\n\n" + message.content;
  previous.content = collapseExcessBlankLines(previous.content);
  if ((previous.displayName ?? null) !== (message.displayName ?? null)) {
    delete previous.displayName;
  }
  const contextKind = mergePromptContextKind(previous.contextKind, message.contextKind);
  if (contextKind) {
    previous.contextKind = contextKind;
  } else {
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

function strictRoleBoundaryLabel(message: ChatMLMessage): string {
  const speaker =
    readString(message.name).trim() || readString(message.displayName).trim() || readString(message.characterId).trim();
  if (speaker) return `${speaker}:`;
  if (message.contextKind === "prompt") return "[Prompt]";
  if (message.contextKind === "history") return "[History]";
  if (message.contextKind === "injection") return "[Injection]";
  return `[${message.role}]`;
}

function strictRoleSegmentContent(message: ChatMLMessage): string {
  return `${strictRoleBoundaryLabel(message)}\n${message.content}`;
}

function mergeIntoStrictRoleSafeMessage(
  previous: ChatMLMessage,
  message: ChatMLMessage,
  normalizedMessages: WeakSet<ChatMLMessage>,
): void {
  const previousContent = normalizedMessages.has(previous) ? previous.content : strictRoleSegmentContent(previous);
  previous.content = collapseExcessBlankLines(`${previousContent}\n\n${strictRoleSegmentContent(message)}`);
  const contextKind = mergePromptContextKind(previous.contextKind, message.contextKind);
  if (contextKind) {
    previous.contextKind = contextKind;
  } else {
    delete previous.contextKind;
  }
  if ((previous.displayName ?? null) !== (message.displayName ?? null)) {
    delete previous.displayName;
  }
  delete previous.characterId;
  delete previous.name;
  delete previous.providerMetadata;
  if (message.images?.length) {
    previous.images = [...(previous.images ?? []), ...message.images];
  }
  normalizedMessages.add(previous);
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
  const targetId = scopedRoleplayGroupTarget(input, characters);
  if (!targetId) return null;
  const metadata = parseRecord(input.chat.metadata);
  if (readString(metadata.groupChatMode, "merged") !== "individual") return null;
  return targetId;
}

function scopedMergedRoleplayGroupTarget(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): string | null {
  const targetId = scopedRoleplayGroupTarget(input, characters);
  if (!targetId) return null;
  const metadata = parseRecord(input.chat.metadata);
  if (readString(metadata.groupChatMode, "merged") === "individual") return null;
  return targetId;
}

function scopedConversationGroupTarget(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): string | null {
  const chatMode = readString(input.chat.mode || input.chat.chatMode);
  if (chatMode !== "conversation" || characters.length <= 1 || input.request.impersonate === true) return null;
  return requestedCharacterTarget(input, characters);
}

function scopedRoleplayGroupTarget(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): string | null {
  const chatMode = readString(input.chat.mode || input.chat.chatMode);
  if (chatMode !== "roleplay" || characters.length <= 1 || input.request.impersonate === true) return null;
  return requestedCharacterTarget(input, characters);
}

function requestedCharacterTarget(input: PromptAssemblyInput, characters: GenerationCharacterContext[]): string | null {
  const requestedCharacterId = readString(input.request.forCharacterId).trim();
  if (!requestedCharacterId) return null;
  return characters.some((character) => character.id === requestedCharacterId) ? requestedCharacterId : null;
}

function promptCharactersForGeneration(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): GenerationCharacterContext[] {
  const targetId = scopedIndividualGroupTarget(input, characters);
  if (targetId) return characters.filter((character) => character.id === targetId);
  const conversationTargetId = scopedConversationGroupTarget(input, characters);
  if (!conversationTargetId) return characters;
  const target = characters.find((character) => character.id === conversationTargetId);
  if (!target) return characters;
  return [target, ...characters.filter((character) => character.id !== conversationTargetId)];
}

function individualGroupTurnPromptMessage(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): ChatMLMessage | null {
  const targetId = scopedIndividualGroupTarget(input, characters);
  if (!targetId) return null;
  if (parseRecord(input.chat.metadata).groupTurnPromptEnabled === false) return null;
  const character = characters.find((candidate) => candidate.id === targetId);
  const name = character?.name.trim() || "the requested character";
  return {
    role: "system",
    content: `Respond only as ${name}`,
    contextKind: "prompt",
    displayName: "Turn",
  };
}

function conversationGroupTurnPromptMessage(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): ChatMLMessage | null {
  const targetId = scopedConversationGroupTarget(input, characters);
  if (!targetId) return null;
  if (parseRecord(input.chat.metadata).groupTurnPromptEnabled === false) return null;
  const character = characters.find((candidate) => candidate.id === targetId);
  const name = character?.name.trim() || "the requested character";
  return {
    role: "system",
    content: `Respond only as ${name}. Use the other attached character cards and recent messages as context, but do not speak as another character in this turn.`,
    contextKind: "prompt",
    displayName: "Turn",
  };
}

function mergedRoleplayGroupTurnPromptMessage(
  input: PromptAssemblyInput,
  characters: GenerationCharacterContext[],
): ChatMLMessage | null {
  const targetId = scopedMergedRoleplayGroupTarget(input, characters);
  if (!targetId) return null;
  if (parseRecord(input.chat.metadata).groupTurnPromptEnabled === false) return null;
  const character = characters.find((candidate) => candidate.id === targetId);
  const name = character?.name.trim() || "the requested character";
  return {
    role: "system",
    content: `The user manually selected ${name} to respond. Write this turn only from ${name}'s perspective and voice. Use the other attached character cards and recent messages as context, but do not let another character answer this turn. Include only minimal scene narration if it is needed to frame ${name}'s response.`,
    contextKind: "prompt",
    displayName: "Turn",
  };
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
  const strictRoleNormalizedMessages = new WeakSet<ChatMLMessage>();
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
    if (message.contextKind === "injection") {
      const previous = result[result.length - 1];
      if (message.role !== "system" && previous?.role === message.role) {
        if (canMergePromptMessages(previous, message)) {
          mergeIntoPreviousPromptMessage(previous, message);
        } else {
          mergeIntoStrictRoleSafeMessage(previous, message, strictRoleNormalizedMessages);
        }
        continue;
      }

      result.push(message);
      expectedRole = message.role === "user" ? "assistant" : "user";
      continue;
    }

    if (message.role === "system") {
      const previous = result[result.length - 1];
      if (previous?.role === "system") {
        mergeIntoPreviousPromptMessage(previous, message);
        continue;
      }
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
    if (previous?.role === effectiveRole) {
      const sameRoleMessage = promptMessageWithRole(message, effectiveRole);
      if (shouldMergeSameRolePromptMessage(previous, sameRoleMessage, effectiveRole)) {
        mergeIntoPreviousPromptMessage(previous, sameRoleMessage);
      } else {
        mergeIntoStrictRoleSafeMessage(previous, sameRoleMessage, strictRoleNormalizedMessages);
      }
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

function macroProfileForCharacter(
  character: GenerationCharacterContext,
  groupScenarioOverride: GroupScenarioOverride = NO_GROUP_SCENARIO_OVERRIDE,
): NonNullable<MacroContext["characterProfiles"]>[number] {
  return {
    name: character.name,
    description: character.description,
    personality: character.personality,
    backstory: character.backstory,
    appearance: character.appearance,
    scenario: groupScenarioOverride.enabled ? groupScenarioOverride.text : character.scenario,
    example: character.mesExample,
    systemPrompt: character.systemPrompt,
    postHistoryInstructions: character.postHistoryInstructions,
  };
}

function macroContextForCharacter(
  base: MacroContext,
  character: GenerationCharacterContext,
  groupScenarioOverride: GroupScenarioOverride = NO_GROUP_SCENARIO_OVERRIDE,
): MacroContext {
  const profile = macroProfileForCharacter(character, groupScenarioOverride);
  return {
    ...base,
    char: character.name,
    characters: [character.name],
    characterProfiles: [profile],
    characterFields: {
      description: character.description,
      personality: character.personality,
      backstory: character.backstory,
      appearance: character.appearance,
      scenario: groupScenarioOverride.enabled ? groupScenarioOverride.text : character.scenario,
      example: character.mesExample,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
    },
  };
}

function resolvePromptMacros(value: string, macros: MacroContext, deferCharacterMacros: boolean): string {
  return resolveMacros(value, macros, {
    trimResult: false,
    deferCharacterMacros: deferCharacterMacros ? "all" : undefined,
  });
}

function finalizeDeferredCharacterMessages(
  messages: ChatMLMessage[],
  macros: MacroContext,
  target: GenerationCharacterContext | null,
): ChatMLMessage[] {
  if (!target || !messages.some((message) => hasDeferredCharacterMacros(message.content))) return messages;
  const profile = macroProfileForCharacter(target);
  return messages.map((message) =>
    hasDeferredCharacterMacros(message.content)
      ? { ...message, content: resolveDeferredCharacterMacros(message.content, profile, macros) }
      : message,
  );
}

function reusableContextMacroScopeMatches(
  reusableContext: PromptAssemblyReusableContext | undefined,
  deferCharacterMacros: boolean,
  targetCharacterId: string | null,
): boolean {
  if (!reusableContext) return false;
  return (
    reusableContext.macroSensitiveScope.deferCharacterMacros === deferCharacterMacros &&
    reusableContext.macroSensitiveScope.targetCharacterId === targetCharacterId
  );
}

function characterDepthPromptEntries(
  characters: GenerationCharacterContext[],
  macros: MacroContext,
  groupScenarioOverride: GroupScenarioOverride,
): Array<{ content: string; role: "system" | "user" | "assistant"; depth: number }> {
  return characters.flatMap((character) => {
    const depthPrompt = character.depthPrompt;
    if (!depthPrompt) return [];
    const content = cleanPromptText(
      resolveMacros(depthPrompt.prompt, macroContextForCharacter(macros, character, groupScenarioOverride)),
    );
    if (!content.trim()) return [];
    return [{ content, role: depthPrompt.role, depth: depthPrompt.depth }];
  });
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
  macros: MacroContext | null;
  groupScenarioOverride: GroupScenarioOverride;
}) {
  switch (args.marker?.type) {
    case "character":
      return renderCharacters(args.characters, args.wrapFormat, args.marker, args.macros, args.groupScenarioOverride);
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

function lorebookIncludedPositionsForPrompt(
  selectedPreset: SelectedPromptPreset | null | undefined,
  chatMode: string,
): ActiveLorebookIncludedPositions {
  const positions: ActiveLorebookIncludedPositions = {
    worldInfoBefore: !selectedPreset || chatMode === "game",
    worldInfoAfter: !selectedPreset || chatMode === "game",
    depth: true,
  };
  for (const section of selectedPreset?.sections ?? []) {
    if (!boolish(section.enabled, true)) continue;
    const marker = markerConfig(section);
    if (marker?.type === "world_info_before" || marker?.type === "lorebook") {
      positions.worldInfoBefore = true;
    }
    if (marker?.type === "world_info_after" || marker?.type === "lorebook") {
      positions.worldInfoAfter = true;
    }
  }
  return positions;
}

function agentDataPromptBlock(
  agentData: Record<string, string>,
  wrapFormat: WrapFormat,
  consumed: { all: boolean; types: Set<string> },
): string {
  if (consumed.all) return "";
  const entries = Object.entries(agentData)
    .map(([type, text]) => ({ type, text: cleanPromptText(text) }))
    .filter((entry) => !consumed.types.has(entry.type))
    .filter((entry) => entry.type.trim() && entry.text.trim());
  if (entries.length === 0) return "";
  const content = entries.map((entry) => `${entry.type}:\n${entry.text}`).join("\n\n");
  return wrapContent(content, "Agent Instructions", wrapFormat);
}

function insertBeforeFirstHistory(messages: ChatMLMessage[], message: ChatMLMessage): void {
  const insertAt = messages.findIndex((entry) => entry.contextKind === "history");
  messages.splice(insertAt >= 0 ? insertAt : messages.length, 0, message);
}

function chatHistoryDepthInjectionBounds(
  messages: ChatMLMessage[],
): { minIndex: number; anchorIndex: number } | undefined {
  const minIndex = messages.findIndex((message) => message.contextKind === "history");
  if (minIndex < 0) return undefined;

  let lastHistoryIndex = minIndex;
  for (let index = minIndex + 1; index < messages.length; index += 1) {
    if (messages[index]?.contextKind === "history") lastHistoryIndex = index;
  }

  return { minIndex, anchorIndex: lastHistoryIndex + 1 };
}

function snapshotMacroVariables(macros: MacroContext): () => void {
  const before = { ...macros.variables };
  return () => {
    for (const name of Object.keys(macros.variables)) {
      if (before[name] === undefined) delete macros.variables[name];
    }
    Object.assign(macros.variables, before);
  };
}

export async function assembleGenerationPrompt(
  storage: StorageGateway,
  rawInput: PromptAssemblyInput,
): Promise<PromptAssemblyResult> {
  let input = rawInput;
  const reusableContext = input.reusableContext;
  const chatMeta = reusableContext?.chatMeta ?? parseRecord(input.chat.metadata);
  const chatMode = reusableContext?.chatMode ?? readString(input.chat.mode || input.chat.chatMode, "conversation");
  if (reusableContext) {
    input = { ...input, storedMessages: reusableContext.storedMessages };
  } else if (chatMode === "game") {
    input = { ...input, storedMessages: applyAllSegmentEdits(input.storedMessages, chatMeta) };
  }

  const characters = reusableContext?.characters ?? (await loadCharacters(storage, input.chat));
  const persona = reusableContext?.persona ?? (await loadPersona(storage, input.chat));
  const selectedPreset =
    reusableContext?.selectedPreset ??
    (await loadSelectedPromptPreset(storage, {
      chat: input.chat,
      connection: input.connection,
      request: input.request,
    }));
  const presetId = reusableContext?.presetId ?? selectedPreset?.id ?? null;
  const promptParameters =
    reusableContext?.promptParameters ??
    mergeStoredGenerationParameters(
      ...generationParameterSources(input.connection, input.request, input.chat, selectedPreset?.parameters),
    );
  const maxContext = reusableContext?.maxContext ?? effectiveMaxContext(input.connection, promptParameters);
  const wrapFormat =
    reusableContext?.wrapFormat ??
    selectedPreset?.wrapFormat ??
    normalizeWrapFormat(input.chat.wrapFormat) ??
    normalizeWrapFormat(input.connection.wrapFormat) ??
    "xml";
  const activeGroupScenarioOverride = reusableContext?.groupScenarioOverride ?? groupScenarioOverride(chatMeta);
  const promptCharacters = reusableContext?.promptCharacters ?? promptCharactersForGeneration(input, characters);
  const individualGroupTarget = scopedIndividualGroupTarget(input, characters);
  const individualGroupTargetCharacter = individualGroupTarget
    ? (characters.find((character) => character.id === individualGroupTarget) ?? null)
    : null;
  const deferCharacterMacros = !!individualGroupTargetCharacter;
  const canReuseMacroSensitiveContext = reusableContextMacroScopeMatches(
    reusableContext,
    deferCharacterMacros,
    individualGroupTarget,
  );
  const embeddingSource =
    reusableContext && canReuseMacroSensitiveContext ? null : memoizedEmbeddingSource(input.embeddingSource);
  const macros = macroContext({
    chat: input.chat,
    connection: input.connection,
    characters: promptCharacters,
    persona,
    latestUserInput: input.latestUserInput,
    agentData: input.agentData,
    variables: selectedPreset?.variables,
    request: input.request,
    groupScenarioOverride: activeGroupScenarioOverride,
  });
  if (selectedPreset)
    resolvePromptChoiceVariableMacros(macros, selectedPreset.choiceVariableNames, deferCharacterMacros);
  const greetingPromptVariables =
    canReuseMacroSensitiveContext && reusableContext
      ? reusableContext.greetingPromptVariables
      : await seedPromptVariablesFromGreeting(storage, input, macros, deferCharacterMacros);
  if (reusableContext) applyReusableGreetingPromptVariables(macros, greetingPromptVariables);
  const baseLorebookIncludedPositions =
    reusableContext?.baseLorebookIncludedPositions ?? lorebookIncludedPositionsForPrompt(selectedPreset, chatMode);
  const scanLorebooksForPositions = (includedPositions: ActiveLorebookIncludedPositions) =>
    scanActiveLorebooks({
      storage,
      chat: input.chat,
      characters,
      persona,
      storedMessages: input.storedMessages,
      request: input.request,
      latestUserInput: input.latestUserInput,
      embeddingSource,
      includedPositions,
      contentResolver: {
        resolve: (content) => cleanPromptText(resolvePromptMacros(content, macros, deferCharacterMacros)),
        snapshotVariables: () => snapshotMacroVariables(macros),
      },
    });
  let loreScan =
    canReuseMacroSensitiveContext && reusableContext
      ? reusableContext.loreScan
      : await scanLorebooksForPositions(baseLorebookIncludedPositions);
  let processedLore =
    canReuseMacroSensitiveContext && reusableContext ? reusableContext.processedLore : loreScan.processedLore;
  const summary = reusableContext?.summary ?? chatSummaryForGeneration(input.chat);
  const memoryRecallBlock =
    reusableContext?.memoryRecallBlock ??
    (await buildMemoryRecallBlock(
      storage,
      input.chat,
      input.storedMessages,
      input.latestUserInput,
      maxContext || undefined,
      embeddingSource,
    ));
  const metadataHistoryLimit = readNumber(chatMeta.contextMessageLimit, 0);
  const requestedHistoryLimit = readNumber(input.request.historyLimit, metadataHistoryLimit || 300);
  const historyLimit = Math.max(1, Math.min(300, metadataHistoryLimit || requestedHistoryLimit || 300));
  const history =
    reusableContext?.history ??
    historyMessages(
      input.storedMessages,
      compactedHistoryLimit(
        chatMeta,
        historyLimit,
        shouldCompactHistoryForSummary(input.chat, selectedPreset, summary),
      ),
      chatMeta.excludePastReasoning === false,
    );
  const agentData = input.agentData ?? {};
  let messages: ChatMLMessage[] = [];
  let insertedHistory = false;
  let insertedSummary = false;
  const insertedAgentData = { all: false, types: new Set<string>() };
  let usedFallbackSystemPrompt = false;

  if (selectedPreset) {
    const groupsById = promptGroupLookup(selectedPreset.groups);
    let promptEntries: PromptAssemblyEntry[] = [];
    const flushPromptEntries = () => {
      if (promptEntries.length === 0) return;
      messages.push(...groupedPromptMessages(promptEntries, wrapFormat));
      promptEntries = [];
    };

    for (const section of selectedPreset.sections) {
      if (!boolish(section.enabled, true)) continue;
      const marker = markerConfig(section);
      if (marker?.type === "chat_history") {
        flushPromptEntries();
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
        macros,
        groupScenarioOverride: activeGroupScenarioOverride,
      });
      const resolvedContent =
        marker?.type === "character" ? rawContent : resolvePromptMacros(rawContent, macros, deferCharacterMacros);
      const resolved = cleanPromptText(resolvedContent);
      if (!resolved.trim()) continue;
      if (marker?.type === "chat_summary" && summary?.trim()) insertedSummary = true;
      if (marker?.type === "agent_data") {
        const agentType = readString(marker.agentType).trim();
        if (agentType) {
          insertedAgentData.types.add(agentType);
        } else {
          insertedAgentData.all = true;
        }
      }
      const name = readString(section.name) || readString(section.identifier) || marker?.type || "Prompt";
      const group = promptGroupForSection(section, groupsById);
      promptEntries.push({
        role: normalizeRole(section.role),
        content: wrapContent(resolved, name, wrapFormat, group ? 1 : 0),
        contextKind: "prompt",
        displayName: name,
        promptGroupId: group?.id ?? null,
        promptGroupName: group?.name ?? null,
      });
    }
    flushPromptEntries();
  }

  if (messages.length === 0) {
    if (
      !reusableContext &&
      (!baseLorebookIncludedPositions.worldInfoBefore || !baseLorebookIncludedPositions.worldInfoAfter)
    ) {
      loreScan = await scanLorebooksForPositions({
        ...baseLorebookIncludedPositions,
        worldInfoBefore: true,
        worldInfoAfter: true,
      });
      processedLore = loreScan.processedLore;
    }
    usedFallbackSystemPrompt = true;
    messages.push({
      role: "system",
      content: fallbackSystemPrompt(input, {
        characters: promptCharacters,
        conversationCharacters: characters,
        persona,
        worldBefore: processedLore.worldInfoBefore,
        worldAfter: processedLore.worldInfoAfter,
        summary,
        wrapFormat,
        macros,
        groupScenarioOverride: activeGroupScenarioOverride,
      }),
      contextKind: "prompt",
    });
  }

  if (
    !usedFallbackSystemPrompt &&
    !insertedSummary &&
    shouldFallbackInsertChatSummary(input.chat, selectedPreset, summary)
  ) {
    appendSummaryToSystemPrompt(messages, summary, wrapFormat);
  }

  const agentDataBlock = agentDataPromptBlock(agentData, wrapFormat, insertedAgentData);
  if (agentDataBlock) {
    insertBeforeFirstHistory(messages, {
      role: "system",
      content: agentDataBlock,
      contextKind: "injection",
      displayName: "Agent Instructions",
    });
  }

  if (!insertedHistory) {
    messages.push(...history);
  }

  const trackerStateBlock = committedTrackerStatePromptMessage(input, wrapFormat);
  if (trackerStateBlock) {
    insertAfterLastHistoryUser(messages, trackerStateBlock);
  }

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
    const narratorStyleBlock = buildRoleplayNarratorStylePromptBlock(input.chat, wrapFormat);
    const sceneBlock = buildRoleplayScenePromptBlock(input.chat, wrapFormat);
    const roleplayBlocks = [narratorStyleBlock, sceneBlock].filter((block): block is string => !!block);
    if (roleplayBlocks.length > 0) {
      const firstSystemIndex = messages.findIndex((message) => message.role === "system");
      messages.splice(firstSystemIndex >= 0 ? firstSystemIndex + 1 : 0, 0, {
        role: "system",
        content: roleplayBlocks.join("\n\n"),
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

  insertBeforeLastUser(messages, [
    ...(await buildConversationContextBlocks(storage, input, characters, wrapFormat)),
    ...buildConnectedConversationBlocks(input.chat),
    ...buildRoleplayDirectMessageCommandReminder(input.chat),
  ]);

  const authorNotesEntry = authorNotesDepthEntry(input.chat);
  const characterDepthEntries =
    chatMode === "game" ? [] : characterDepthPromptEntries(promptCharacters, macros, activeGroupScenarioOverride);
  messages = injectAtDepth(
    messages,
    authorNotesEntry
      ? [...processedLore.depthEntries, ...characterDepthEntries, authorNotesEntry]
      : [...processedLore.depthEntries, ...characterDepthEntries],
    chatHistoryDepthInjectionBounds(messages),
  );
  const regexScripts = (await storage.list<JsonRecord>("regex-scripts")).sort(bySortOrder);
  applyRegexScriptsToPromptMessages(messages, regexScripts, {
    resolveMacros: (value) => resolvePromptMacros(value, macros, deferCharacterMacros),
  });
  const turnPrompt =
    individualGroupTurnPromptMessage(input, characters) ??
    mergedRoleplayGroupTurnPromptMessage(input, characters) ??
    conversationGroupTurnPromptMessage(input, characters);
  if (turnPrompt) {
    messages.push(turnPrompt);
  }
  messages = messages
    .map((message) => ({
      ...message,
      content: collapseExcessBlankLines(stripPromptComments(message.content)).trim(),
    }))
    .filter((message) => message.content.length > 0);
  if (individualGroupTarget) {
    messages = scopeIndividualGroupHistoryRoles(messages, individualGroupTarget);
  }
  const conversationGroupTarget = scopedConversationGroupTarget(input, characters);
  if (conversationGroupTarget) {
    messages = scopeIndividualGroupHistoryRoles(messages, conversationGroupTarget);
  }
  messages = finalizeDeferredCharacterMessages(messages, macros, individualGroupTargetCharacter);
  if (messages.some((message) => hasDeferredCharacterMacros(message.content))) {
    throw new Error("Deferred character macro placeholder remained before prompt handoff");
  }
  const previewMessages = previewMessagesForPrompt(messages);
  const shouldEnforceStrictRoles = boolish(promptParameters?.strictRoleFormatting, true) && !individualGroupTarget;
  messages = shouldEnforceStrictRoles ? enforceStrictRoles(messages) : mergeAdjacentMessages(messages);
  if (!shouldEnforceStrictRoles && boolish(promptParameters?.squashSystemMessages, false)) {
    messages = squashLeadingSystemMessages(messages);
  }
  if (boolish(promptParameters?.singleUserMessage, false)) {
    messages = collapseToSingleUserMessage(messages);
  }
  const summaryFingerprint = fingerprintChatSummary(summary);
  const nextReusableContext: PromptAssemblyReusableContext = reusableContext ?? {
    chatMeta,
    chatMode,
    storedMessages: input.storedMessages,
    characters,
    persona,
    selectedPreset,
    presetId,
    promptParameters,
    maxContext,
    wrapFormat,
    groupScenarioOverride: activeGroupScenarioOverride,
    promptCharacters,
    baseLorebookIncludedPositions,
    loreScan,
    processedLore,
    summary,
    memoryRecallBlock,
    history,
    greetingPromptVariables,
    macroSensitiveScope: {
      deferCharacterMacros,
      targetCharacterId: individualGroupTarget,
    },
  };

  return {
    messages,
    previewMessages,
    promptPresetId: presetId,
    parameters: selectedPreset?.parameters ?? null,
    wrapFormat,
    characters: promptCharacters,
    persona,
    activatedLorebookEntries: processedLore.includedEntries.map(lorebookActivatedEntryForEvent),
    lorebookTimingStates: loreScan.lorebookTimingStates,
    lorebookEntryStateOverrides: loreScan.lorebookEntryStateOverrides,
    budgetSkippedLorebookEntries: loreScan.budgetSkippedLorebookEntries,
    chatSummary: summary,
    chatSummaryFingerprint: summaryFingerprint,
    reusableContext: nextReusableContext,
  };
}
