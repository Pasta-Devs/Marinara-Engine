import type { Chat } from "../../../../engine/contracts/types/chat";
import type {
  CombatAttack,
  CombatEnemy,
  CombatInitState,
  CombatMechanic,
  CombatPartyMember,
  EncounterSettings,
} from "../../../../engine/contracts/types/combat-encounter";
import type {
  Combatant,
  CombatPlayerAction,
  GameActiveState,
  GameCheckpoint,
  GameMap,
  GameNpc,
  GameSetupConfig,
  HudWidget,
  PartyArc,
  SessionSummary,
  SkillCheckResult,
} from "../../../../engine/contracts/types/game";
import type { RPGAttributes } from "../../../../engine/contracts/types/game-state";
import { ApiError, type JsonRepairRequest } from "../../../../shared/api/api-errors";
import { gameAssetsApi } from "../../../../shared/api/assets-api";
import { imageGenerationApi } from "../../../../shared/api/image-generation-api";
import { integrationGateway } from "../../../../shared/api/integration-gateway";
import { spotifyApi } from "../../../../shared/api/integration-utility-api";
import { llmApi } from "../../../../shared/api/llm-api";
import { storageApi } from "../../../../shared/api/storage-api";
import {
  createLorebookEntrySchema,
  createLorebookSchema,
} from "../../../../engine/contracts/schemas/lorebook.schema";
import { resolveCombatRound } from "../../../../engine/modes/game/mechanics/combat.service";
import { rollDice as rollGameDice } from "../../../../engine/modes/game/mechanics/dice.service";
import {
  rollEncounter as rollGameEncounter,
  rollEnemyCount,
} from "../../../../engine/modes/game/mechanics/encounter.service";
import {
  generateCombatLoot,
  generateLootTable,
  type LootDrop,
} from "../../../../engine/modes/game/mechanics/loot.service";
import { processReputationActions } from "../../../../engine/modes/game/mechanics/reputation.service";
import {
  getGoverningAttribute,
  mapSheetAttributesToRPG,
  resolveSkillCheck,
} from "../../../../engine/modes/game/mechanics/skill-check.service";
import { serializeResolvedSkillCheckTag } from "../../../../engine/shared/scoring/skill-check-format";
import {
  applyMoraleEvent,
  getMoraleTier,
  type MoraleEvent,
} from "../../../../engine/modes/game/mechanics/morale.service";
import {
  getElementPreset,
  listElementPresets,
} from "../../../../engine/modes/game/mechanics/element-reactions.service";
import { buildPartySystemPrompt } from "../../../../engine/modes/game/prompts/party-prompts";
import { buildSessionConclusionPrompt, buildSetupPrompt } from "../../../../engine/modes/game/prompts/gm-prompts";
import {
  GAME_BACKGROUND_PROMPT_OVERRIDE,
  GAME_ILLUSTRATION_PROMPT_OVERRIDE,
  GAME_PORTRAIT_PROMPT_OVERRIDE,
  loadRegisteredPrompt,
  type ImagePromptOverrideContext,
  type PromptOverrideKeyDef,
} from "../../../../engine/generation/prompt-overrides";
import { dedupeSessionSummaryLists } from "../../../../engine/modes/game/state/session-summary-normalization";
import { buildRecapPrompt, buildSessionCarryoverContext } from "../../../../engine/modes/game/state/session.service";
import { validateTransition } from "../../../../engine/modes/game/state/state-machine.service";
import {
  addCombatEntry,
  addEventEntry,
  addInventoryEntry,
  addLocationEntry,
  addNoteEntry,
  buildDeterministicSummary,
  buildStructuredRecap,
  createJournal,
  type Journal,
  type JournalEntry,
} from "../../../../engine/modes/game/world/journal.service";
import { buildMapGenerationPrompt } from "../../../../engine/modes/game/world/map.service";
import { withActiveGameMapMeta } from "../../../../engine/modes/game/world/map-position.service";
import {
  createInitialTime,
  formatGameTime,
  advanceTime as advanceGameTime,
  type GameTime,
} from "../../../../engine/modes/game/world/time.service";
import { generateWeather, inferBiome, type Season, type WeatherState } from "../../../../engine/modes/game/world/weather.service";
import { parsePartyDialogue } from "../lib/party-dialogue-parser";

export interface CreateGameResponse {
  sessionChat: Chat;
  gameId: string;
}

export interface SetupResponse {
  setup: Record<string, unknown>;
  worldOverview: string | null;
  sessionChat: Chat;
}

export interface StartGameResponse {
  status: string;
  alreadyStarted?: boolean;
  sessionChat: Chat;
}

export interface StartSessionResponse {
  sessionChat: Chat;
  sessionNumber: number;
  recap: string;
}

export interface SessionSummaryResponse {
  summary: SessionSummary;
  sessionChat: Chat;
}

export interface RegenerateSessionLorebookResponse {
  sessionNumber: number;
  lorebookId: string;
  entryCount: number;
  sessionChat: Chat;
}

export interface UpdateCampaignProgressionResponse {
  sessionChat: Chat;
  gameId: string;
  campaignProgression: {
    storyArc: string | null;
    plotTwists: string[];
    partyArcs: unknown[];
  };
}

export interface PartyCardResponse {
  sessionChat: Chat;
  added?: boolean;
  removed?: boolean;
  characterName: string;
  cardCreated?: boolean;
  gameCard?: unknown;
}

export interface MapResponse {
  map: GameMap;
  maps?: GameMap[];
  activeGameMapId?: string | null;
  sessionChat: Chat;
}

export interface GameJournalResponse {
  journal: Journal;
  recap: string;
  playerNotes?: string;
}

export interface GameImagePromptReviewItem {
  id: string;
  kind: "background" | "illustration" | "portrait";
  title: string;
  prompt: string;
  width: number;
  height: number;
}

export interface GameAssetGenerationResult {
  generatedBackground: string | null;
  fallbackBackground: string | null;
  generatedIllustration: { tag: string; segment?: number } | null;
  generatedNpcAvatars: Array<{ name: string; avatarUrl: string }>;
  sessionChat?: Chat;
}

type ImagePromptSettings = {
  includeAppearances?: boolean;
  format?: "descriptive" | "tags";
};

export type GameAssetGenerationPayload = {
  chatId: string;
  backgroundTag?: string;
  npcsNeedingAvatars?: Array<{ name: string; description: string }>;
  forceNpcAvatarNames?: string[];
  illustration?: unknown;
  imageConnectionId?: string | null;
  artStylePrompt?: string | null;
  imageSizes?: Record<string, { width?: number; height?: number }>;
  imagePromptSettings?: ImagePromptSettings;
  promptOverrides?: PromptOverride[];
  [key: string]: unknown;
};

type ChatMessage = {
  id?: string;
  role?: string;
  content?: string;
  [key: string]: unknown;
};

type PromptOverride = {
  id?: string;
  prompt?: string;
};

type GameJsonRepairKind =
  | "game_setup"
  | "game_map"
  | "session_conclusion"
  | "session_lorebook"
  | "campaign_progression";

type GameJsonRepairContext = {
  kind: GameJsonRepairKind;
  title: string;
  applyBody: Record<string, unknown>;
};

function newId(prefix = ""): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}-${id}` : id;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function chatMeta(chat: Chat | null | undefined): Record<string, unknown> {
  return asRecord(chat?.metadata);
}

function discordWebhookUrl(meta: Record<string, unknown>): string {
  return typeof meta.discordWebhookUrl === "string" ? meta.discordWebhookUrl.trim() : "";
}

function mirrorGameMessageToDiscord(meta: Record<string, unknown>, content: string, username: string): void {
  const webhookUrl = discordWebhookUrl(meta);
  const trimmed = content.trim();
  if (!webhookUrl || !trimmed) return;
  if (!integrationGateway.discord) {
    console.warn("[game] Discord mirror skipped: integration gateway unavailable");
    return;
  }
  void integrationGateway.discord.mirrorMessage({ webhookUrl, content: trimmed, username }).catch((error) => {
    console.warn("[game] Discord mirror failed", error);
  });
}

async function getChat(chatId: string): Promise<Chat> {
  const chat = await storageApi.get<Chat>("chats", chatId);
  if (!chat) throw new Error(`Chat ${chatId} was not found.`);
  return chat;
}

async function patchChatMetadata(chatId: string, patch: Record<string, unknown>): Promise<Chat> {
  const chat = await getChat(chatId);
  return storageApi.update<Chat>("chats", chatId, { metadata: { ...chatMeta(chat), ...patch } });
}

async function patchChat(chatId: string, patch: Record<string, unknown>): Promise<Chat> {
  return storageApi.update<Chat>("chats", chatId, patch);
}

async function listMessages(chatId: string, limit?: number): Promise<ChatMessage[]> {
  return storageApi.list<ChatMessage>("messages", { filters: { chatId }, limit });
}

async function createChatRecord(value: Record<string, unknown>): Promise<Chat> {
  return storageApi.create<Chat>("chats", value);
}

async function createChatMessage(chatId: string, value: Record<string, unknown>): Promise<ChatMessage> {
  return storageApi.create<ChatMessage>("messages", { ...value, chatId });
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return parseJsonObject(fenced);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackGameBlueprint(preferences: string): Record<string, unknown> {
  const overview = preferences.trim()
    ? `A local campaign shaped around: ${preferences.trim()}`
    : "A flexible local campaign ready for play.";
  return {
    worldOverview: overview,
    hudWidgets: [
      { id: "party", type: "party", title: "Party", enabled: true },
      { id: "journal", type: "journal", title: "Journal", enabled: true },
      { id: "inventory", type: "inventory", title: "Inventory", enabled: true },
    ],
    introSequence: ["Frame the opening situation clearly.", "Invite the player to choose the first action."],
    visualTheme: { palette: "default", uiStyle: "classic", moodDefault: "neutral" },
    campaignPlan: {
      questSeeds: [],
      encounterPrinciples: ["Keep conflicts actionable.", "Let player choices alter the world state."],
    },
  };
}

function defaultGameMap(name = "Starting Area", description = "The party's current area."): GameMap {
  return {
    id: newId("map"),
    type: "grid",
    name,
    description,
    width: 3,
    height: 3,
    cells: [
      {
        x: 1,
        y: 1,
        emoji: "Start",
        label: "Start",
        discovered: true,
        terrain: "safe",
        description: "The party's starting point.",
      },
    ],
    partyPosition: { x: 1, y: 1 },
  } as GameMap;
}

function setupMapFromResponse(setup: Record<string, unknown>): GameMap {
  const startingMap = asRecord(setup.startingMap);
  const regions = Array.isArray(startingMap.regions) ? startingMap.regions.map(asRecord) : [];
  if (regions.length === 0) {
    return defaultGameMap(
      typeof startingMap.name === "string" && startingMap.name.trim() ? startingMap.name : "Starting Area",
      typeof startingMap.description === "string" ? startingMap.description : "The party's current area.",
    );
  }

  const columns = Math.max(2, Math.ceil(Math.sqrt(regions.length)));
  const nodes = regions.map((region, index) => {
    const id = typeof region.id === "string" && region.id.trim() ? region.id.trim() : `region_${index + 1}`;
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id,
      emoji: typeof region.emoji === "string" && region.emoji.trim() ? region.emoji.trim() : "•",
      label: typeof region.name === "string" && region.name.trim() ? region.name.trim() : `Area ${index + 1}`,
      x: columns <= 1 ? 50 : 15 + (70 * column) / Math.max(1, columns - 1),
      y: 20 + row * 24,
      discovered: region.discovered !== false,
      description: typeof region.description === "string" ? region.description : "",
    };
  });
  const knownIds = new Set(nodes.map((node) => node.id));
  const edges = regions.flatMap((region, index) => {
    const from = nodes[index]!.id;
    const targets = Array.isArray(region.connectedTo) ? region.connectedTo : [];
    return targets
      .map(String)
      .filter((to) => knownIds.has(to))
      .map((to) => ({ from, to }));
  });
  return {
    id: newId("map"),
    type: "node",
    name: typeof startingMap.name === "string" && startingMap.name.trim() ? startingMap.name.trim() : "Starting Area",
    description: typeof startingMap.description === "string" ? startingMap.description : "",
    nodes,
    edges,
    partyPosition: nodes[0]!.id,
  } as GameMap;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type GeneratedMapNodeNormalization = {
  rawId: string | null;
  node: NonNullable<GameMap["nodes"]>[number];
};

function readNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return fallback;
  const parsed = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(readNumber(value, fallback))));
}

function clampPercent(value: unknown, fallback: number): number {
  return Math.max(0, Math.min(100, readNumber(value, fallback)));
}

function normalizeGeneratedGridCell(
  value: unknown,
  index: number,
  width: number,
  height: number,
): NonNullable<GameMap["cells"]>[number] | null {
  const record = asRecord(value);
  const x = clampInteger(record.x, index % width, 0, width - 1);
  const y = clampInteger(record.y, Math.floor(index / width), 0, height - 1);
  const label = readOptionalString(record, "label") ?? `Area ${index + 1}`;
  return {
    x,
    y,
    emoji: readOptionalString(record, "emoji") ?? "",
    label,
    discovered: record.discovered !== false,
    terrain: readOptionalString(record, "terrain") ?? "unknown",
    ...(readOptionalString(record, "description") ? { description: readOptionalString(record, "description")! } : {}),
  };
}

function uniqueGeneratedNodeId(rawId: string, usedIds: Set<string>): string {
  const base = rawId.trim() || "location";
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizeGeneratedMapNode(
  value: unknown,
  index: number,
  usedIds: Set<string>,
): GeneratedMapNodeNormalization | null {
  const record = asRecord(value);
  const label = readOptionalString(record, "label") ?? readOptionalString(record, "name") ?? `Area ${index + 1}`;
  const rawId = readOptionalString(record, "id") ?? generatedAssetSlug(label);
  const id = uniqueGeneratedNodeId(rawId, usedIds);
  if (!id) return null;
  return {
    rawId,
    node: {
      id,
      emoji: readOptionalString(record, "emoji") ?? "",
      label,
      x: clampPercent(record.x, 50),
      y: clampPercent(record.y, 50),
      discovered: record.discovered !== false,
      ...(readOptionalString(record, "description") ? { description: readOptionalString(record, "description")! } : {}),
    },
  };
}

function resolveGeneratedNodeReference(
  rawId: string | null,
  knownNodeIds: Set<string>,
  normalizedIdsByRawId: Map<string, string[]>,
): string | null {
  if (!rawId) return null;
  if (knownNodeIds.has(rawId)) return rawId;
  return normalizedIdsByRawId.get(rawId)?.[0] ?? null;
}

function normalizeGeneratedMapEdge(
  value: unknown,
  knownNodeIds: Set<string>,
  normalizedIdsByRawId: Map<string, string[]>,
): NonNullable<GameMap["edges"]>[number] | null {
  const record = asRecord(value);
  const rawFrom = readOptionalString(record, "from");
  const rawTo = readOptionalString(record, "to");
  const duplicateAliases = rawFrom && rawFrom === rawTo ? normalizedIdsByRawId.get(rawFrom) : null;
  const from =
    duplicateAliases && duplicateAliases.length > 1
      ? duplicateAliases[0]!
      : resolveGeneratedNodeReference(rawFrom, knownNodeIds, normalizedIdsByRawId);
  const to =
    duplicateAliases && duplicateAliases.length > 1
      ? duplicateAliases[1]!
      : resolveGeneratedNodeReference(rawTo, knownNodeIds, normalizedIdsByRawId);
  if (!from || !to || from === to) return null;
  return {
    from,
    to,
    ...(readOptionalString(record, "label") ? { label: readOptionalString(record, "label")! } : {}),
  };
}

function normalizeGridPartyPosition(
  value: unknown,
  fallback: { x: number; y: number },
  width: number,
  height: number,
  knownCoordinates: Set<string>,
): { x: number; y: number } {
  const record = asRecord(value);
  const candidate = {
    x: clampInteger(record.x, fallback.x, 0, width - 1),
    y: clampInteger(record.y, fallback.y, 0, height - 1),
  };
  return knownCoordinates.has(`${candidate.x},${candidate.y}`) ? candidate : fallback;
}

function normalizeGeneratedMap(raw: unknown, fallback: GameMap): GameMap | null {
  const record = asRecord(raw);
  const type = record.type === "grid" || record.type === "node" ? record.type : null;
  if (!type) return null;
  const name = readOptionalString(record, "name") ?? fallback.name;
  const base = {
    id: readOptionalString(record, "id") ?? generatedAssetSlug(name),
    type,
    name,
    description: readOptionalString(record, "description") ?? fallback.description,
  };
  if (type === "grid") {
    const width = clampInteger(record.width, fallback.width ?? 6, 1, 12);
    const height = clampInteger(record.height, fallback.height ?? 6, 1, 12);
    const cellByCoordinate = new Map<string, NonNullable<GameMap["cells"]>[number]>();
    if (Array.isArray(record.cells)) {
      record.cells.slice(0, width * height).forEach((cell, index) => {
        const normalizedCell = normalizeGeneratedGridCell(cell, index, width, height);
        if (!normalizedCell) return;
        const key = `${normalizedCell.x},${normalizedCell.y}`;
        if (!cellByCoordinate.has(key)) cellByCoordinate.set(key, normalizedCell);
      });
    }
    const cells = [...cellByCoordinate.values()];
    if (cells.length === 0) return null;
    const fallbackCell = cells.find((cell) => cell.discovered) ?? cells[0]!;
    const fallbackPosition = { x: fallbackCell.x, y: fallbackCell.y };
    const knownCoordinates = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
    const partyPosition = normalizeGridPartyPosition(
      record.partyPosition,
      fallbackPosition,
      width,
      height,
      knownCoordinates,
    );
    return {
      ...base,
      type: "grid",
      width,
      height,
      cells: cells.map((cell) =>
        cell.x === partyPosition.x && cell.y === partyPosition.y ? { ...cell, discovered: true } : cell,
      ),
      partyPosition,
    };
  }
  const usedNodeIds = new Set<string>();
  const nodeEntries = Array.isArray(record.nodes)
    ? record.nodes
        .slice(0, 80)
        .map((node, index) => normalizeGeneratedMapNode(node, index, usedNodeIds))
        .filter((entry): entry is GeneratedMapNodeNormalization => !!entry)
    : [];
  const nodes = nodeEntries.map((entry) => entry.node);
  if (nodes.length === 0) return null;
  const knownNodeIds = new Set(nodes.map((node) => node.id));
  const normalizedIdsByRawId = new Map<string, string[]>();
  for (const entry of nodeEntries) {
    if (!entry.rawId) continue;
    normalizedIdsByRawId.set(entry.rawId, [...(normalizedIdsByRawId.get(entry.rawId) ?? []), entry.node.id]);
  }
  const edges = Array.isArray(record.edges)
    ? record.edges
        .slice(0, 160)
        .map((edge) => normalizeGeneratedMapEdge(edge, knownNodeIds, normalizedIdsByRawId))
        .filter((edge): edge is NonNullable<GameMap["edges"]>[number] => !!edge)
    : [];
  const partyPosition =
    typeof record.partyPosition === "string" && knownNodeIds.has(record.partyPosition.trim())
      ? record.partyPosition.trim()
      : nodes[0]!.id;
  return {
    ...base,
    type: "node",
    nodes,
    edges,
    partyPosition,
  };
}

function gameMapJsonRepairContext(data: {
  chatId: string;
  locationType: string;
  context: string;
  connectionId?: string | null;
}): GameJsonRepairContext {
  return {
    kind: "game_map",
    title: "Repair Game Map JSON",
    applyBody: {
      chatId: data.chatId,
      locationType: data.locationType,
      context: data.context,
      connectionId: data.connectionId,
    },
  };
}

function mapJsonCouldNotApplyError(
  generated: Record<string, unknown>,
  data: { chatId: string; locationType: string; context: string; connectionId?: string | null },
): ApiError {
  const repair = gameMapJsonRepairContext(data);
  return new ApiError("The model returned map JSON that needs review before it can be applied.", 422, {
    jsonRepair: {
      kind: repair.kind,
      title: repair.title,
      rawJson: JSON.stringify(generated, null, 2),
      applyEndpoint: `local://game/${repair.kind}`,
      applyBody: repair.applyBody,
    },
  });
}

function setupNpcsFromResponse(setup: Record<string, unknown>): GameNpc[] {
  const raw = Array.isArray(setup.startingNpcs) ? setup.startingNpcs : [];
  return raw.map((npc, index) => {
    const record = asRecord(npc);
    return {
      id: newId("npc"),
      emoji: typeof record.emoji === "string" && record.emoji.trim() ? record.emoji.trim() : "👤",
      name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : `NPC ${index + 1}`,
      description: typeof record.description === "string" ? record.description : "",
      descriptionSource: "model",
      location: typeof record.location === "string" ? record.location : "",
      reputation: Number.isFinite(Number(record.reputation)) ? Number(record.reputation) : 0,
      met: true,
      notes: typeof record.role === "string" && record.role.trim() ? [`Role: ${record.role.trim()}`] : [],
      avatarUrl: null,
    } satisfies GameNpc;
  });
}

function setupCharacterCards(setup: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(setup.characterCards) ? setup.characterCards.map(asRecord) : [];
}

function setupBlueprint(setup: Record<string, unknown>, fallback: Record<string, unknown>): Record<string, unknown> {
  const rawBlueprint = asRecord(setup.blueprint);
  const fallbackWidgets = Array.isArray(fallback.hudWidgets) ? fallback.hudWidgets : [];
  return {
    ...rawBlueprint,
    hudWidgets: Array.isArray(rawBlueprint.hudWidgets) ? rawBlueprint.hudWidgets : fallbackWidgets,
    introSequence: Array.isArray(rawBlueprint.introSequence) ? rawBlueprint.introSequence : fallback.introSequence,
    visualTheme:
      Object.keys(asRecord(rawBlueprint.visualTheme)).length > 0 ? rawBlueprint.visualTheme : fallback.visualTheme,
    campaignPlan:
      Object.keys(asRecord(rawBlueprint.campaignPlan)).length > 0
        ? rawBlueprint.campaignPlan
        : asRecord(setup.campaignPlan ?? fallback.campaignPlan),
  };
}

function gameTimeFromMeta(meta: Record<string, unknown>): GameTime {
  const raw = asRecord(meta.gameTime);
  const day = Number(raw.day ?? 1);
  const hour = Number(raw.hour ?? 8);
  const minute = Number(raw.minute ?? 0);
  return {
    day: Number.isFinite(day) && day >= 1 ? day : 1,
    hour: Number.isFinite(hour) ? Math.max(0, Math.min(23, Math.floor(hour))) : 8,
    minute: Number.isFinite(minute) ? Math.max(0, Math.min(59, Math.floor(minute))) : 0,
  };
}

function moraleFromMeta(meta: Record<string, unknown>): number {
  const raw = meta.gameMorale;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 50;
}

function syncMoraleWidgets(rawWidgets: unknown, morale: number): unknown {
  if (!Array.isArray(rawWidgets)) return rawWidgets;
  return rawWidgets.map((widget) => {
    const record = asRecord(widget);
    const label = `${record.title ?? record.label ?? record.id ?? record.type ?? ""}`.toLowerCase();
    if (!label.includes("morale")) return widget;
    const config = asRecord(record.config);
    return {
      ...record,
      value: morale,
      config: {
        ...config,
        value: morale,
      },
    };
  });
}

function moraleMetadataPatch(meta: Record<string, unknown>, morale: number): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    gameMorale: morale,
    gameMoraleTier: getMoraleTier(morale),
  };
  const widgetState = syncMoraleWidgets(meta.gameWidgetState, morale);
  if (widgetState !== meta.gameWidgetState) patch.gameWidgetState = widgetState;
  const blueprint = asRecord(meta.gameBlueprint);
  const hudWidgets = syncMoraleWidgets(blueprint.hudWidgets, morale);
  if (hudWidgets !== blueprint.hudWidgets) {
    patch.gameBlueprint = {
      ...blueprint,
      hudWidgets,
    };
  }
  return patch;
}

function journalFromMeta(meta: Record<string, unknown>): Journal {
  const raw = asRecord(meta.gameJournal);
  return {
    entries: Array.isArray(raw.entries) ? (raw.entries as Journal["entries"]) : [],
    quests: Array.isArray(raw.quests) ? (raw.quests as Journal["quests"]) : [],
    locations: Array.isArray(raw.locations) ? (raw.locations as string[]) : [],
    npcLog: Array.isArray(raw.npcLog) ? (raw.npcLog as Journal["npcLog"]) : [],
    inventoryLog: Array.isArray(raw.inventoryLog) ? (raw.inventoryLog as Journal["inventoryLog"]) : [],
  };
}

function isGameSetupConfig(value: unknown): value is GameSetupConfig {
  const record = asRecord(value);
  return (
    typeof record.genre === "string" && typeof record.setting === "string" && Array.isArray(record.partyCharacterIds)
  );
}

function gameSetupChatPatch(config: GameSetupConfig, connectionId?: string | null): Record<string, unknown> {
  const characterIds = (config.partyCharacterIds ?? []).filter(
    (id) => typeof id === "string" && !id.startsWith("npc:"),
  );
  return {
    characterIds,
    personaId: config.personaId ?? null,
    ...(connectionId ? { connectionId } : {}),
  };
}

function gameSetupMetadataPatch(config: GameSetupConfig): Record<string, unknown> {
  return {
    gameSetupConfig: config,
    gamePartyCharacterIds: config.partyCharacterIds ?? [],
    activeLorebookIds: config.activeLorebookIds ?? [],
    gameSceneConnectionId: config.sceneConnectionId ?? null,
    gameImageConnectionId: config.imageConnectionId ?? null,
    enableSpriteGeneration: Boolean(config.enableSpriteGeneration),
    gameUseSpotifyMusic: Boolean(config.enableSpotifyDj),
    gameSpotifySourceType: config.spotifySourceType ?? null,
    gameSpotifyPlaylistId: config.spotifyPlaylistId ?? null,
    gameSpotifyPlaylistName: config.spotifyPlaylistName ?? null,
    gameSpotifyArtist: config.spotifyArtist ?? null,
    gameEnableLorebookKeeper: Boolean(config.enableLorebookKeeper),
    gameGenerationParameters: config.generationParameters ?? null,
    gameLanguage: config.language ?? null,
    gameRating: config.rating ?? "sfw",
  };
}

function sessionSummary(sessionNumber: number, meta: Record<string, unknown>): SessionSummary {
  const journal = journalFromMeta(meta);
  const npcs = Array.isArray(meta.gameNpcs) ? (meta.gameNpcs as GameNpc[]) : [];
  const map = (meta.gameMap as GameMap | null) ?? null;
  return {
    ...buildDeterministicSummary(journal, sessionNumber, npcs, map),
    nextSessionRequest: null,
    timestamp: nowIso(),
  } as SessionSummary;
}

function normalizeSessionSummaryPayload(
  raw: unknown,
  fallback: SessionSummary,
  nextSessionRequest?: string | null,
): SessionSummary {
  const record = asRecord(raw);
  const factLists = dedupeSessionSummaryLists({
    keyDiscoveries: normalizeSessionSummaryTextList(record.keyDiscoveries, fallback.keyDiscoveries),
    characterMoments: normalizeSessionSummaryTextList(record.characterMoments, fallback.characterMoments),
    littleDetails: normalizeSessionSummaryTextList(record.littleDetails, fallback.littleDetails),
    npcUpdates: normalizeSessionSummaryTextList(record.npcUpdates, fallback.npcUpdates),
  });
  return {
    sessionNumber: Number.isFinite(Number(record.sessionNumber))
      ? Number(record.sessionNumber)
      : fallback.sessionNumber,
    summary: typeof record.summary === "string" && record.summary.trim() ? record.summary : fallback.summary,
    resumePoint:
      typeof record.resumePoint === "string" && record.resumePoint.trim() ? record.resumePoint : fallback.resumePoint,
    partyDynamics:
      typeof record.partyDynamics === "string" && record.partyDynamics.trim()
        ? record.partyDynamics
        : fallback.partyDynamics,
    partyState:
      typeof record.partyState === "string" && record.partyState.trim() ? record.partyState : fallback.partyState,
    keyDiscoveries: factLists.keyDiscoveries,
    characterMoments: factLists.characterMoments,
    littleDetails: factLists.littleDetails,
    statsSnapshot:
      Object.keys(asRecord(record.statsSnapshot)).length > 0 ? asRecord(record.statsSnapshot) : fallback.statsSnapshot,
    npcUpdates: factLists.npcUpdates,
    nextSessionRequest:
      nextSessionRequest ??
      (typeof record.nextSessionRequest === "string"
        ? record.nextSessionRequest
        : (fallback.nextSessionRequest ?? null)),
    timestamp: typeof record.timestamp === "string" ? record.timestamp : nowIso(),
  };
}

function normalizeSessionSummaryTextList(raw: unknown, fallback: string[]): string[] {
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : fallback;
}

function gameCardName(card: Record<string, unknown>, fallback: string): string {
  const value = card.name;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function gameCardTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function gameCardRpgStatsPrompt(value: unknown): Record<string, unknown> {
  const stats = asRecord(value);
  const promptStats: Record<string, unknown> = {};
  const attributes = Array.isArray(stats.attributes)
    ? stats.attributes
        .map(asRecord)
        .map((attribute) => {
          const name = typeof attribute.name === "string" ? attribute.name.trim() : "";
          const numericValue = Number(attribute.value);
          const next: Record<string, unknown> = {};
          if (name) next.name = name;
          if (Number.isFinite(numericValue)) next.value = numericValue;
          return next;
        })
        .filter((attribute) => Object.keys(attribute).length > 0)
    : [];
  if (attributes.length) promptStats.attributes = attributes;

  const hp = asRecord(stats.hp);
  const promptHp: Record<string, number> = {};
  const hpValue = Number(hp.value);
  const hpMax = Number(hp.max);
  if (Number.isFinite(hpValue)) promptHp.value = hpValue;
  if (Number.isFinite(hpMax)) promptHp.max = hpMax;
  if (Object.keys(promptHp).length) promptStats.hp = promptHp;

  return promptStats;
}

function gameCardPromptText(card: Record<string, unknown>): string {
  return JSON.stringify(
    {
      name: gameCardName(card, "Party member"),
      shortDescription: typeof card.shortDescription === "string" ? card.shortDescription : "",
      class: typeof card.class === "string" ? card.class : "",
      abilities: gameCardTextList(card.abilities),
      strengths: gameCardTextList(card.strengths),
      weaknesses: gameCardTextList(card.weaknesses),
      rpgStats: gameCardRpgStatsPrompt(card.rpgStats),
    },
    null,
    2,
  );
}

function gameSessionSortValue(chat: Chat): number {
  const meta = chatMeta(chat);
  const value = Number(meta.gameSessionNumber ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function gameCarryoverPatch(meta: Record<string, unknown>) {
  const keys = [
    "gameSetupConfig",
    "gameWorldOverview",
    "gameBlueprint",
    "gameCampaignProgression",
    "gameMap",
    "gameMaps",
    "activeGameMapId",
    "gameNpcs",
    "gameCharacterCards",
    "gamePartyArcs",
    "gameArtStylePrompt",
    "enableSpriteGeneration",
    "gameImageConnectionId",
    "activeLorebookIds",
    "gameInventory",
    "gameWidgetState",
    "gameTime",
    "gameTimeFormatted",
    "gameWeather",
    "gameMorale",
    "gameMoraleTier",
    "gamePlayerNotes",
    "gameJournal",
    "gameSessionLorebookId",
    "gameSessionLorebookEntryCount",
    "gameJournal",
    "discordWebhookUrl",
  ];
  return Object.fromEntries(keys.filter((key) => key in meta).map((key) => [key, meta[key]]));
}

function gameStateCarryoverPatch(previousChat: Chat | null | undefined, nextChatId: string): Record<string, unknown> {
  const previousGameState = asRecord((previousChat as { gameState?: unknown } | null | undefined)?.gameState);
  if (Object.keys(previousGameState).length === 0) return {};
  return {
    gameState: {
      ...previousGameState,
      id: "",
      chatId: nextChatId,
      messageId: "",
      createdAt: nowIso(),
    },
  };
}

function normalizeJournalEntry(
  type: string,
  data: Record<string, unknown>,
): Pick<JournalEntry, "type" | "title" | "content"> {
  const title =
    typeof data.title === "string"
      ? data.title
      : typeof data.name === "string"
        ? data.name
        : type === "location"
          ? "Location"
          : type === "npc"
            ? "NPC"
            : type === "combat"
              ? "Combat"
              : type === "item"
                ? "Item"
                : type === "quest"
                  ? "Quest"
                  : type === "note"
                    ? "Note"
                    : "Event";
  const content =
    typeof data.content === "string" ? data.content : typeof data.description === "string" ? data.description : "";
  return { type: type as JournalEntry["type"], title, content };
}

function applyJournalEntry(journal: Journal, type: string, data: Record<string, unknown>): Journal {
  if (type === "location") {
    const { title, content } = normalizeJournalEntry(type, data);
    return addLocationEntry(journal, title, content);
  }
  if (type === "combat") {
    const { content } = normalizeJournalEntry(type, data);
    const outcome =
      data.outcome === "defeat" || data.outcome === "fled" || data.result === "defeat" || data.result === "fled"
        ? (data.outcome ?? data.result)
        : "victory";
    return addCombatEntry(journal, content, outcome as "victory" | "defeat" | "fled");
  }
  if (type === "item") {
    const item = typeof data.name === "string" ? data.name : typeof data.title === "string" ? data.title : "Item";
    const action =
      data.action === "used" || data.action === "lost" || data.action === "removed" ? data.action : "acquired";
    const quantity = Number(data.quantity ?? 1);
    return addInventoryEntry(journal, item, action, Number.isFinite(quantity) ? quantity : 1);
  }
  if (type === "note") {
    const { title, content } = normalizeJournalEntry(type, data);
    const readableType = data.readableType === "book" ? "book" : "note";
    return addNoteEntry(journal, title, content, {
      readableType,
      sourceMessageId: typeof data.sourceMessageId === "string" ? data.sourceMessageId : undefined,
      sourceSegmentIndex: Number.isInteger(data.sourceSegmentIndex) ? (data.sourceSegmentIndex as number) : undefined,
    });
  }
  const { title, content } = normalizeJournalEntry(type, data);
  return addEventEntry(journal, title, content);
}

function buildGameCard(characterName: string): Record<string, unknown> {
  return {
    name: characterName,
    shortDescription: "",
    class: "Adventurer",
    abilities: ["Attack", "Assist"],
    strengths: [],
    weaknesses: [],
    extra: {},
    rpgStats: {
      attributes: [
        { name: "STR", value: 10 },
        { name: "DEX", value: 10 },
        { name: "CON", value: 10 },
        { name: "INT", value: 10 },
        { name: "WIS", value: 10 },
        { name: "CHA", value: 10 },
      ],
      hp: { value: 20, max: 20 },
    },
  };
}

function playerAttributes(meta: Record<string, unknown>): Partial<RPGAttributes> {
  const cards = Array.isArray(meta.gameCharacterCards) ? meta.gameCharacterCards : [];
  const first = asRecord(cards[0]);
  const rpgStats = asRecord(first.rpgStats);
  return mapSheetAttributesToRPG(
    Array.isArray(rpgStats.attributes)
      ? (rpgStats.attributes as ReadonlyArray<{ name: string; value: number }>)
      : undefined,
  );
}

function isWeatherSeason(value: unknown): value is Season {
  return value === "spring" || value === "summer" || value === "autumn" || value === "winter";
}

function replaceFirstUnresolvedSkillCheckTag(content: string, resolvedTag: string): string {
  let replaced = false;
  return content.replace(/\[skill_check:\s*([^\]]+)\]/gi, (fullTag, body: string) => {
    if (replaced) return fullTag;
    if (/\bresult\s*=/i.test(body)) return fullTag;
    replaced = true;
    return resolvedTag;
  });
}

const SKILL_CHECK_HISTORY_PERSIST_ATTEMPTS = 3;

async function persistResolvedSkillCheckTag(
  chatId: string,
  messageId: string | undefined,
  result: SkillCheckResult,
): Promise<string | undefined> {
  const id = typeof messageId === "string" ? messageId.trim() : "";
  if (!id) return undefined;
  try {
    const conditionalUpdate = storageApi.updateChatMessageContentIfUnchanged;
    if (typeof conditionalUpdate !== "function") {
      throw new Error("Conditional chat message content update is unavailable");
    }
    const resolvedTag = serializeResolvedSkillCheckTag(result);
    for (let attempt = 0; attempt < SKILL_CHECK_HISTORY_PERSIST_ATTEMPTS; attempt += 1) {
      const message = await storageApi.get<ChatMessage>("messages", id);
      if (typeof message?.chatId !== "string" || message.chatId !== chatId) return undefined;
      const content = typeof message?.content === "string" ? message.content : "";
      if (!content) return undefined;
      const updatedContent = replaceFirstUnresolvedSkillCheckTag(content, resolvedTag);
      if (updatedContent === content) return undefined;
      const update = await conditionalUpdate<ChatMessage>(chatId, id, content, updatedContent);
      if (update.updated) {
        return typeof update.message?.content === "string" ? update.message.content : updatedContent;
      }
    }
    return undefined;
  } catch (error) {
    console.warn("[game] skill check history persist failed", error);
    return undefined;
  }
}

function generatedAssetSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return slug || `generated-${Date.now()}`;
}

function imageReviewId(kind: string, key: string): string {
  return `${kind}:${generatedAssetSlug(key)}`;
}

function promptOverride(payload: Record<string, unknown>, id: string): string | null {
  const overrides = Array.isArray(payload.promptOverrides) ? (payload.promptOverrides as PromptOverride[]) : [];
  const override = overrides.find((item) => item.id === id && typeof item.prompt === "string" && item.prompt.trim());
  return override?.prompt?.trim() ?? null;
}

function imageSize(
  payload: Record<string, unknown>,
  bucket: string,
  axis: "width" | "height",
  fallback: number,
): number {
  const bucketSize = asRecord(asRecord(payload.imageSizes)[bucket]);
  const value = Number(bucketSize[axis]);
  return Number.isFinite(value) && value >= 128 && value <= 2048 ? value : fallback;
}

function imagePromptSettings(payload: Record<string, unknown>): ImagePromptSettings {
  const raw = asRecord(payload.imagePromptSettings);
  return {
    includeAppearances: raw.includeAppearances !== false,
    format: raw.format === "tags" ? "tags" : "descriptive",
  };
}

function joinedImageTags(parts: string[]): string {
  const seen = new Set<string>();
  return parts
    .flatMap((part) => part.split(/[,.]/))
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

function sceneAssetPrompt(
  kind: string,
  label: string,
  detail: string,
  artStyle: string,
  settings: ImagePromptSettings,
): string {
  const style = artStyle.trim() || "polished fantasy visual novel art, cinematic lighting, high detail";
  if (settings.format === "tags") {
    const detailPart = kind === "portrait" && settings.includeAppearances === false ? "" : detail;
    if (kind === "background") {
      return joinedImageTags([
        "wide establishing background",
        label,
        detail,
        style,
        "no characters",
        "no text",
        "immersive environment art",
      ]);
    }
    if (kind === "illustration") {
      return joinedImageTags([
        "cinematic scene illustration",
        label,
        detail,
        style,
        "dynamic composition",
        "no text",
        "high detail",
      ]);
    }
    return joinedImageTags([
      "portrait",
      label,
      detailPart,
      style,
      "centered bust portrait",
      "expressive face",
      "clean readable silhouette",
      "no text",
    ]);
  }
  if (kind === "background") {
    return `Wide establishing background of ${label}. ${detail}. ${style}. No characters, no text, immersive environment art.`;
  }
  if (kind === "illustration") {
    return `Cinematic scene illustration: ${label}. ${detail}. ${style}. Dynamic composition, no text, high detail.`;
  }
  if (settings.includeAppearances === false) {
    return `Portrait of ${label}. ${style}. Centered bust portrait, expressive face, clean readable silhouette, no text.`;
  }
  return `Portrait of ${label}. ${detail}. ${style}. Centered bust portrait, expressive face, clean readable silhouette, no text.`;
}

async function registeredGameImagePrompt(
  definition: PromptOverrideKeyDef<ImagePromptOverrideContext>,
  input: {
    defaultPrompt: string;
    label: string;
    detail: string;
    artStyle: string;
    promptSettings: ImagePromptSettings;
  },
): Promise<string> {
  return loadRegisteredPrompt(storageApi, definition, {
    defaultPrompt: input.defaultPrompt,
    label: input.label,
    detail: input.detail,
    artStyle: input.artStyle,
    format: input.promptSettings.format ?? "descriptive",
    includeAppearances: String(input.promptSettings.includeAppearances !== false),
  });
}

function assetTagFromPath(path: string): string {
  return path.replace(/\.[^.]+$/, "").replace(/[\\/]/g, ":");
}

function imageExt(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

function base64File(base64: string, name: string, type: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], name, { type });
}

async function uploadGeneratedAsset(
  category: string,
  subcategory: string,
  slug: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const uploaded = (await gameAssetsApi.upload({
    category,
    subcategory,
    file: base64File(base64, `${slug}.${imageExt(mimeType)}`, mimeType),
  })) as { item?: { path?: string } };
  const path = uploaded.item?.path;
  if (!path) throw new Error("Generated asset path missing.");
  return assetTagFromPath(path);
}

function spotifyQuery(payload: Record<string, unknown>): string {
  const text = [payload.narration, payload.playerAction]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const words = text
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word.length > 3)
    .slice(0, 8);
  return words.length ? words.join(" ") : "cinematic adventure soundtrack";
}

function recentSpotifyTracks(payload: Record<string, unknown>): string[] {
  const context = asRecord(payload.context);
  return Array.isArray(context.recentSpotifyTracks)
    ? context.recentSpotifyTracks.filter(
        (uri): uri is string => typeof uri === "string" && uri.startsWith("spotify:track:"),
      )
    : [];
}

async function llmJson(input: {
  connectionId?: string | null;
  system: string;
  user: string;
  fallback: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  repair?: GameJsonRepairContext;
}): Promise<Record<string, unknown>> {
  if (!input.connectionId) return input.fallback;
  const raw = await llmApi.complete({
    connectionId: input.connectionId,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    parameters: input.parameters,
  });
  const parsed = parseJsonObject(raw);
  if (parsed) return parsed;
  if (input.repair) {
    throw new ApiError("The model returned JSON that needs review before it can be applied.", 422, {
      jsonRepair: {
        kind: input.repair.kind,
        title: input.repair.title,
        rawJson: raw,
        applyEndpoint: `local://game/${input.repair.kind}`,
        applyBody: input.repair.applyBody,
      },
    });
  }
  throw new Error("The model returned JSON that could not be parsed.");
}

async function sessionTranscript(chatId: string, limit = 80): Promise<string> {
  const messages = await listMessages(chatId, limit);
  return messages
    .map((message) => `${message.role ?? "message"}: ${message.content ?? ""}`)
    .filter((line) => line.trim())
    .join("\n");
}

export const gameApi = {
  async createGame(data: {
    name: string;
    setupConfig: GameSetupConfig;
    connectionId?: string;
    characterConnectionId?: string;
    promptPresetId?: string;
    chatId?: string;
    folderId?: string | null;
    partyCharacterIds?: string[];
  }): Promise<CreateGameResponse> {
    const gameId = newId("game");
    if (data.chatId) {
      await patchChat(data.chatId, gameSetupChatPatch(data.setupConfig, data.connectionId ?? null));
      const sessionChat = await patchChatMetadata(data.chatId, {
        gameId,
        gameSessionNumber: 1,
        gameSessionStatus: "setup",
        ...gameSetupMetadataPatch(data.setupConfig),
        gameJournal: createJournal(),
      });
      return { sessionChat, gameId };
    }
    const chatPatch = gameSetupChatPatch(data.setupConfig, data.connectionId ?? null);
    const sessionChat = await createChatRecord({
      name: data.name || "New Game",
      mode: "game",
      characterIds: data.partyCharacterIds ?? chatPatch.characterIds ?? [],
      personaId: data.setupConfig.personaId ?? null,
      folderId: data.folderId ?? null,
      connectionId: data.connectionId ?? null,
      metadata: {
        gameId,
        gameSessionNumber: 1,
        gameSessionStatus: "setup",
        ...gameSetupMetadataPatch(data.setupConfig),
        gameJournal: createJournal(),
      },
    });
    return { sessionChat, gameId };
  },

  async setupGame(data: {
    chatId: string;
    connectionId?: string;
    preferences: string;
    setupConfig?: GameSetupConfig;
    setup?: Record<string, unknown>;
  }): Promise<SetupResponse> {
    const existingChat = await getChat(data.chatId);
    const existingMeta = chatMeta(existingChat);
    const fallback = fallbackGameBlueprint(data.preferences);
    const setupConfig =
      data.setupConfig ?? (isGameSetupConfig(existingMeta.gameSetupConfig) ? existingMeta.gameSetupConfig : undefined);
    const setup =
      data.setup ??
      (await llmJson({
        connectionId: data.connectionId,
        fallback,
        system: buildSetupPrompt({
          rating: setupConfig?.rating ?? "sfw",
          enableCustomWidgets: setupConfig?.enableCustomWidgets !== false,
          language: setupConfig?.language,
        }),
        user: [
          `Player preferences:`,
          data.preferences,
          ``,
          setupConfig
            ? `Structured setup config:\n${JSON.stringify(
                {
                  genre: setupConfig.genre,
                  setting: setupConfig.setting,
                  tone: setupConfig.tone,
                  difficulty: setupConfig.difficulty,
                  playerGoals: setupConfig.playerGoals,
                },
                null,
                2,
              )}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        parameters: { temperature: 0.8, maxTokens: 8192 },
        repair: {
          kind: "game_setup",
          title: "Repair Game Setup JSON",
          applyBody: {
            chatId: data.chatId,
            connectionId: data.connectionId,
            preferences: data.preferences,
            setupConfig,
          },
        },
      }));
    const worldOverview =
      typeof setup.worldOverview === "string"
        ? setup.worldOverview
        : typeof setup.overview === "string"
          ? setup.overview
          : (fallback.worldOverview as string);
    const map = setupMapFromResponse(setup);
    const blueprint = setupBlueprint(setup, fallback);
    const startingNpcs = setupNpcsFromResponse(setup);
    const characterCards = setupCharacterCards(setup);
    const campaignProgression = {
      storyArc: typeof setup.storyArc === "string" ? setup.storyArc : null,
      plotTwists: Array.isArray(setup.plotTwists)
        ? setup.plotTwists.filter((item): item is string => typeof item === "string")
        : [],
      partyArcs: Array.isArray(setup.partyArcs) ? setup.partyArcs : [],
    };
    if (setupConfig) {
      await patchChat(
        data.chatId,
        gameSetupChatPatch(setupConfig, data.connectionId ?? existingChat.connectionId ?? null),
      );
    }
    const sessionChat = await patchChatMetadata(data.chatId, {
      ...(setupConfig ? gameSetupMetadataPatch(setupConfig) : { gameSetupPreferences: data.preferences ?? null }),
      gameSessionStatus: "ready",
      gameWorldOverview: worldOverview,
      gameBlueprint: blueprint,
      gameCampaignProgression: campaignProgression,
      gameMap: map,
      gameMaps: [map],
      activeGameMapId: map.id ?? null,
      gameNpcs: startingNpcs,
      gameCharacterCards: characterCards,
      gamePartyArcs: campaignProgression.partyArcs,
      gameArtStylePrompt:
        typeof setup.artStylePrompt === "string" ? setup.artStylePrompt : (setupConfig?.artStylePrompt ?? null),
      gameTime: createInitialTime(),
      gameJournal: createJournal(),
    });
    return { setup, worldOverview, sessionChat };
  },

  async startGame(data: { chatId: string }): Promise<StartGameResponse> {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const sessionStatus = typeof meta.gameSessionStatus === "string" ? meta.gameSessionStatus : "ready";
    const recentMessages = await listMessages(data.chatId, 40).catch(() => []);
    const hasExistingGmTurn = recentMessages.some((message) => {
      if (message.role !== "assistant") return false;
      if (typeof message.content !== "string" || !message.content.trim()) return false;
      return asRecord(message.extra).hiddenFromAi !== true;
    });
    if (sessionStatus === "active" && hasExistingGmTurn) {
      return { status: "active", alreadyStarted: true, sessionChat: chat };
    }
    if (sessionStatus !== "ready" && sessionStatus !== "active") {
      throw new Error(`Cannot start game: status is "${sessionStatus}", expected "ready"`);
    }
    if (hasExistingGmTurn) {
      const sessionChat = await patchChatMetadata(data.chatId, { gameSessionStatus: "active" });
      return { status: "active", alreadyStarted: true, sessionChat };
    }
    const sessionChat = await patchChatMetadata(data.chatId, {
      gameSessionStatus: "active",
      gameActiveState: "exploration",
    });
    return { status: "active", alreadyStarted: false, sessionChat };
  },

  async startSession(data: { gameId: string; connectionId?: string }): Promise<StartSessionResponse> {
    const chats = await storageApi.list<Chat>("chats");
    const existing = chats
      .filter((chat) => chatMeta(chat).gameId === data.gameId)
      .sort((a, b) => gameSessionSortValue(a) - gameSessionSortValue(b));
    const sessionNumber = existing.length + 1;
    const previousChat = existing[existing.length - 1] ?? null;
    const previousMeta = chatMeta(previousChat);
    const summaries = Array.isArray(previousMeta.gamePreviousSessionSummaries)
      ? [...(previousMeta.gamePreviousSessionSummaries as SessionSummary[])].sort(
          (a, b) => a.sessionNumber - b.sessionNumber,
        )
      : [];
    const latestEndingBeat = (await sessionTranscript(existing[existing.length - 1]?.id ?? "", 8).catch(() => ""))
      .split("\n")
      .filter(Boolean)
      .slice(-2)
      .join("\n");
    let recap = summaries.length ? buildSessionCarryoverContext(summaries) : "";
    if (summaries.length && data.connectionId) {
      try {
        recap = await llmApi.complete({
          connectionId: data.connectionId,
          messages: [
            { role: "system", content: "Write only the requested game-session recap narration. Do not return JSON." },
            { role: "user", content: buildRecapPrompt(summaries, latestEndingBeat) },
          ],
          parameters: { temperature: 0.7, maxTokens: 1200 },
        });
      } catch {
        recap = buildSessionCarryoverContext(summaries);
      }
    }
    const sessionChatId = newId("chat");
    const sessionChat = await createChatRecord({
      id: sessionChatId,
      name: `Game Session ${sessionNumber}`,
      mode: "game",
      characterIds: Array.isArray(previousChat?.characterIds) ? previousChat.characterIds : [],
      personaId: previousChat?.personaId ?? null,
      folderId: previousChat?.folderId ?? null,
      connectionId: data.connectionId ?? previousChat?.connectionId ?? null,
      ...gameStateCarryoverPatch(previousChat, sessionChatId),
      metadata: {
        ...gameCarryoverPatch(previousMeta),
        gameId: data.gameId,
        gameSessionNumber: sessionNumber,
        gameSessionStatus: "active",
        gameActiveState: "exploration",
        gamePreviousSessionSummaries: summaries,
        gameSessionCarryover: buildSessionCarryoverContext(summaries),
        gameJournal: journalFromMeta(previousMeta),
      },
    });
    if (recap.trim()) {
      await createChatMessage(sessionChat.id, {
        role: "system",
        characterId: null,
        content: `[session-recap]\n${recap.trim()}`,
        extra: { hiddenFromAi: false, isSessionRecap: true },
      });
      mirrorGameMessageToDiscord(chatMeta(sessionChat), recap.trim(), "Narrator");
    }
    return { sessionChat, sessionNumber, recap };
  },

  async concludeSession(data: {
    chatId: string;
    connectionId?: string;
    nextSessionRequest?: string;
    summary?: SessionSummary;
    generated?: Record<string, unknown>;
  }): Promise<SessionSummaryResponse> {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const sessionNumber = Number(meta.gameSessionNumber ?? 1);
    const fallback = sessionSummary(sessionNumber, meta);
    let summary = normalizeSessionSummaryPayload(data.summary, fallback, data.nextSessionRequest ?? null);
    let campaignProgression = meta.gameCampaignProgression;
    let characterCards = Array.isArray(meta.gameCharacterCards) ? meta.gameCharacterCards : [];
    if (!data.summary && data.generated) {
      summary = normalizeSessionSummaryPayload(
        asRecord(data.generated.summary),
        fallback,
        data.nextSessionRequest ?? null,
      );
      campaignProgression = asRecord(data.generated.campaignProgression);
      characterCards = Array.isArray(data.generated.characterCards) ? data.generated.characterCards : characterCards;
    } else if (!data.summary && data.connectionId) {
      const transcript = await sessionTranscript(data.chatId, 160);
      const generated = await llmJson({
        connectionId: data.connectionId,
        fallback: { summary, campaignProgression, characterCards },
        system: buildSessionConclusionPrompt({
          language:
            typeof asRecord(meta.gameSetupConfig).language === "string"
              ? (asRecord(meta.gameSetupConfig).language as string)
              : null,
          includeCharacterCards: characterCards.length > 0,
        }),
        user: [
          `Current campaign progression:`,
          JSON.stringify(campaignProgression ?? {}, null, 2),
          ``,
          `Current character cards:`,
          JSON.stringify(characterCards, null, 2),
          ``,
          `Session transcript:`,
          transcript,
        ].join("\n"),
        parameters: { temperature: 0.35, maxTokens: 5000 },
        repair: {
          kind: "session_conclusion",
          title: `Repair Session ${sessionNumber} Conclusion JSON`,
          applyBody: {
            chatId: data.chatId,
            connectionId: data.connectionId,
            nextSessionRequest: data.nextSessionRequest,
          },
        },
      });
      summary = normalizeSessionSummaryPayload(asRecord(generated.summary), fallback, data.nextSessionRequest ?? null);
      campaignProgression = asRecord(generated.campaignProgression);
      characterCards = Array.isArray(generated.characterCards) ? generated.characterCards : characterCards;
    }
    const summaries = Array.isArray(meta.gamePreviousSessionSummaries)
      ? [...(meta.gamePreviousSessionSummaries as SessionSummary[])]
      : [];
    const nextSummaries = summaries.filter((item) => item.sessionNumber !== sessionNumber).concat(summary);
    const sessionChat = await patchChatMetadata(data.chatId, {
      gameSessionStatus: "concluded",
      gamePreviousSessionSummaries: nextSummaries,
      gameCampaignProgression: campaignProgression,
      gameCharacterCards: characterCards,
    });
    return { summary, sessionChat };
  },

  async regenerateSessionLorebook(data: {
    chatId: string;
    sessionNumber: number;
    connectionId?: string;
    generated?: Record<string, unknown>;
  }): Promise<RegenerateSessionLorebookResponse> {
    const transcript = await sessionTranscript(data.chatId);
    const fallbackEntries = transcript.trim()
      ? [
          {
            name: `Session ${data.sessionNumber} Recap`,
            content: transcript.split("\n").slice(0, 12).join("\n"),
            keys: [`session ${data.sessionNumber}`, "recap", "campaign"],
          },
        ]
      : [
          {
            name: `Session ${data.sessionNumber} State`,
            content: "No transcript was available; preserve the current campaign state from the chat metadata.",
            keys: [`session ${data.sessionNumber}`],
          },
        ];
    const parsed =
      data.generated ??
      (await llmJson({
        connectionId: data.connectionId,
        fallback: { entries: fallbackEntries },
        system:
          "Extract durable campaign lore from the session transcript. Return strict JSON with an entries array; each entry has name, content, and keys array.",
        user: transcript,
        parameters: { temperature: 0.3, maxTokens: 2500 },
        repair: {
          kind: "session_lorebook",
          title: `Repair Session ${data.sessionNumber} Lorebook JSON`,
          applyBody: {
            chatId: data.chatId,
            sessionNumber: data.sessionNumber,
            connectionId: data.connectionId,
          },
        },
      }));
    const entries = Array.isArray(parsed.entries) && parsed.entries.length ? parsed.entries : fallbackEntries;
    const lorebook = await storageApi.create<{ id: string }>(
      "lorebooks",
      createLorebookSchema.parse({
        name: `Game Session ${data.sessionNumber} Lore`,
        description: "Generated from local game session state.",
        category: "game",
        chatId: data.chatId,
        enabled: true,
        generatedBy: "game-session",
      }),
    );
    let entryCount = 0;
    for (const [index, rawEntry] of entries.entries()) {
      const entry = asRecord(rawEntry);
      await storageApi.create(
        "lorebook-entries",
        createLorebookEntrySchema.parse({
          lorebookId: lorebook.id,
          name: typeof entry.name === "string" ? entry.name : "Session Lore",
          content: typeof entry.content === "string" ? entry.content : "",
          keys: Array.isArray(entry.keys) ? entry.keys : [`session ${data.sessionNumber}`],
          secondaryKeys: [],
          enabled: true,
          constant: false,
          selective: false,
          order: index,
          position: 0,
          role: "system",
          excludeFromVectorization: false,
        }),
      );
      entryCount += 1;
    }
    const sessionChat = await patchChatMetadata(data.chatId, {
      gameSessionLorebookId: lorebook.id,
      gameSessionLorebookEntryCount: entryCount,
    });
    return { sessionNumber: data.sessionNumber, lorebookId: lorebook.id, entryCount, sessionChat };
  },

  async updateCampaignProgression(data: {
    chatId: string;
    sessionNumber: number;
    connectionId?: string;
    generated?: Record<string, unknown>;
  }): Promise<UpdateCampaignProgressionResponse> {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const transcript = await sessionTranscript(data.chatId);
    const fallback = {
      storyArc: transcript.trim() ? `Session ${data.sessionNumber} advanced the campaign.` : null,
      plotTwists: [],
      partyArcs: [],
    };
    const campaignProgression = (data.generated ??
      (await llmJson({
        connectionId: data.connectionId,
        fallback,
        system:
          "Update campaign progression from this game session. Return strict JSON with storyArc, plotTwists, and partyArcs.",
        user: transcript,
        parameters: { temperature: 0.4, maxTokens: 1800 },
        repair: {
          kind: "campaign_progression",
          title: `Repair Session ${data.sessionNumber} Plot JSON`,
          applyBody: {
            chatId: data.chatId,
            sessionNumber: data.sessionNumber,
            connectionId: data.connectionId,
          },
        },
      }))) as UpdateCampaignProgressionResponse["campaignProgression"];
    const sessionChat = await patchChatMetadata(data.chatId, {
      gameCampaignProgression: campaignProgression,
      gameCampaignProgressionUpdatedAt: nowIso(),
    });
    return { sessionChat, gameId: String(meta.gameId ?? ""), campaignProgression };
  },

  async upsertPartyCard(data: {
    chatId: string;
    characterName: string;
    characterId?: string;
    connectionId?: string;
    added?: boolean;
  }): Promise<PartyCardResponse> {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const cards = Array.isArray(meta.gameCharacterCards) ? [...meta.gameCharacterCards] : [];
    const card = buildGameCard(data.characterName);
    const nextCards = cards.filter((item) => asRecord(item).name !== data.characterName).concat(card);
    const sessionChat = await patchChatMetadata(data.chatId, { gameCharacterCards: nextCards });
    return {
      sessionChat,
      added: data.added,
      characterName: data.characterName,
      cardCreated: true,
      gameCard: card,
    };
  },

  async removePartyMember(data: { chatId: string; characterName: string }): Promise<PartyCardResponse> {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const cards = Array.isArray(meta.gameCharacterCards) ? [...meta.gameCharacterCards] : [];
    const nextCards = cards.filter((item) => asRecord(item).name !== data.characterName);
    const sessionChat = await patchChatMetadata(data.chatId, { gameCharacterCards: nextCards });
    return { sessionChat, removed: nextCards.length !== cards.length, characterName: data.characterName };
  },

  async rollDice(data: { notation: string }) {
    return { result: rollGameDice(data.notation) };
  },

  async skillCheck(data: {
    chatId: string;
    skill: string;
    dc: number;
    advantage?: boolean;
    disadvantage?: boolean;
    preRolledD20?: number;
    skillModifier?: number;
    messageId?: string;
  }) {
    const meta = chatMeta(await getChat(data.chatId));
    const attrs = playerAttributes(meta);
    const attr = getGoverningAttribute(data.skill);
    const attrScore = Number(attrs[attr] ?? 10);
    const result = resolveSkillCheck({
      skill: data.skill,
      dc: data.dc,
      skillModifier: Number(data.skillModifier ?? 0),
      attributeModifier: Math.floor((attrScore - 10) / 2),
      advantage: data.advantage,
      disadvantage: data.disadvantage,
      preRolledD20: data.preRolledD20,
    });
    return {
      result,
      updatedContent: await persistResolvedSkillCheckTag(data.chatId, data.messageId, result),
    };
  },

  async transitionGameState(data: { chatId: string; newState: GameActiveState }) {
    const meta = chatMeta(await getChat(data.chatId));
    const previousState = (meta.gameActiveState as GameActiveState | undefined) ?? "exploration";
    const newState = validateTransition(previousState, data.newState);
    const sessionChat = await patchChatMetadata(data.chatId, { gameActiveState: newState });
    return { previousState, newState, sessionChat };
  },

  async generateMap(data: {
    chatId: string;
    locationType: string;
    context: string;
    connectionId?: string | null;
    generated?: Record<string, unknown>;
  }): Promise<MapResponse> {
    const fallbackMap = defaultGameMap(data.locationType || "Area", data.context || "");
    let map = fallbackMap;
    if (data.generated || data.connectionId) {
      const generated =
        data.generated ??
        (await llmJson({
          connectionId: data.connectionId,
          fallback: fallbackMap as unknown as Record<string, unknown>,
          system: "You generate compact RPG map JSON for Marinara Engine Game mode.",
          user: buildMapGenerationPrompt(data.locationType || "Area", data.context || ""),
          repair: gameMapJsonRepairContext(data),
        }));
      const normalizedMap = normalizeGeneratedMap(generated, fallbackMap);
      if (!normalizedMap) {
        if (data.generated) throw new Error("The repaired map JSON object could not be applied.");
        throw mapJsonCouldNotApplyError(generated, data);
      }
      map = normalizedMap;
    }
    const chat = await getChat(data.chatId);
    const meta = withActiveGameMapMeta(chatMeta(chat), map);
    const sessionChat = await patchChatMetadata(data.chatId, meta);
    const savedMap = (meta.gameMap as GameMap | undefined) ?? map;
    const savedMaps = Array.isArray(meta.gameMaps) ? (meta.gameMaps as GameMap[]) : [savedMap];
    const activeGameMapId = typeof meta.activeGameMapId === "string" ? meta.activeGameMapId : (savedMap.id ?? null);
    return { map: savedMap, maps: savedMaps, activeGameMapId, sessionChat };
  },

  async moveOnMap(data: {
    chatId: string;
    position: { x: number; y: number } | string;
    mapId?: string | null;
  }): Promise<MapResponse> {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const maps = Array.isArray(meta.gameMaps) ? (meta.gameMaps as GameMap[]) : [];
    const current = (maps.find((map) => map.id === data.mapId) ??
      (meta.gameMap as GameMap | undefined) ??
      defaultGameMap()) as GameMap;
    const map = { ...current, partyPosition: data.position } as GameMap;
    const nextMeta = withActiveGameMapMeta(meta, map);
    const sessionChat = await patchChatMetadata(data.chatId, nextMeta);
    return {
      map,
      maps: Array.isArray(nextMeta.gameMaps) ? (nextMeta.gameMaps as GameMap[]) : [map],
      activeGameMapId: typeof nextMeta.activeGameMapId === "string" ? nextMeta.activeGameMapId : (map.id ?? null),
      sessionChat,
    };
  },

  async updateWidgets(data: { chatId: string; widgets: HudWidget[] }) {
    const sessionChat = await patchChatMetadata(data.chatId, { gameWidgetState: data.widgets });
    return { ok: true, sessionChat };
  },

  async gameSessions(gameId: string): Promise<Chat[]> {
    const chats = await storageApi.list<Chat>("chats");
    return chats.filter((chat) => chatMeta(chat).gameId === gameId);
  },

  async combatRound(data: {
    combatants: Array<Omit<Combatant, "sprite">>;
    round: number;
    playerAction?: CombatPlayerAction;
    mechanics?: CombatMechanic[];
    elementPreset?: string;
  }) {
    const combatants: Array<Omit<Combatant, "sprite">> = data.combatants.map((combatant) => ({ ...combatant }));
    const result = resolveCombatRound(
      combatants,
      data.round,
      "normal",
      data.elementPreset,
      data.playerAction,
      data.mechanics,
    );
    return { result, combatants: combatants as Combatant[] };
  },

  async applyMoraleEvent(data: { chatId: string; event: MoraleEvent; modifier?: number }) {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const morale = applyMoraleEvent(moraleFromMeta(meta), data.event, data.modifier);
    const sessionChat = await patchChatMetadata(data.chatId, moraleMetadataPatch(meta, morale.value));
    return { morale, sessionChat };
  },

  async elementPresets() {
    return {
      presets: listElementPresets().map((id) => {
        const preset = getElementPreset(id);
        return {
          id,
          name: preset.name,
          elementCount: preset.elements.length,
          reactionCount: preset.reactions.length,
        };
      }),
    };
  },

  async elementPreset(name: string) {
    const preset = getElementPreset(name);
    return {
      name: preset.name,
      elements: preset.elements,
      reactions: preset.reactions,
    };
  },

  async combatLoot(data: { enemyCount: number; difficulty?: string }) {
    return { drops: generateCombatLoot(data.enemyCount, data.difficulty ?? "normal") };
  },

  async lootGenerate(data: { count?: number; difficulty?: string }): Promise<{ drops: LootDrop[] }> {
    return { drops: generateLootTable(Math.max(0, Math.min(10, data.count ?? 1)), data.difficulty ?? "normal") };
  },

  async advanceTime(data: {
    chatId: string;
    action: string;
  }): Promise<{ time: GameTime; formatted: string; sessionChat: Chat }> {
    const meta = chatMeta(await getChat(data.chatId));
    const time = advanceGameTime(gameTimeFromMeta(meta), data.action);
    const formatted = formatGameTime(time);
    const sessionChat = await patchChatMetadata(data.chatId, { gameTime: time, gameTimeFormatted: formatted });
    return { time, formatted, sessionChat };
  },

  async updateWeather(data: {
    chatId: string;
    action: string;
    location?: string;
    season?: string;
    type?: string;
  }): Promise<{ changed: boolean; weather: WeatherState; sessionChat: Chat }> {
    const chat = await getChat(data.chatId);
    let forced: WeatherState;
    if (data.type) {
      forced = { type: data.type, temperature: 20, description: "", wind: "calm", visibility: "clear" } as WeatherState;
    } else {
      const biome = inferBiome(data.location ?? "");
      const season = isWeatherSeason(data.season) ? data.season : "summer";
      if (data.season && season === "summer" && data.season !== "summer") {
        console.warn("[game] Invalid weather season; defaulting to summer", {
          season: data.season,
          biome,
          location: data.location ?? "",
        });
      }
      forced = generateWeather(biome, season);
    }
    const changed =
      Boolean(data.type) ||
      Math.random() <
        (data.action === "travel" ? 0.35 : data.action === "rest_long" ? 0.6 : data.action === "explore" ? 0.2 : 0.08);
    const sessionChat = changed ? await patchChatMetadata(data.chatId, { gameWeather: forced }) : chat;
    return { changed, weather: forced, sessionChat };
  },

  async rollEncounter(data: { action: string; location?: string; difficulty?: string; partySize?: number }) {
    const encounter = rollGameEncounter(data.action, data.difficulty ?? "normal", data.location ?? "");
    const enemyCount =
      encounter.type === "combat" ? rollEnemyCount(data.partySize ?? 1, data.difficulty ?? "normal") : 0;
    return { encounter, enemyCount };
  },

  async updateReputation(data: {
    chatId: string;
    actions: Array<{ npcId: string; action: string; modifier?: number }>;
  }) {
    const chat = await getChat(data.chatId);
    const meta = chatMeta(chat);
    const npcs = Array.isArray(meta.gameNpcs) ? (meta.gameNpcs as GameNpc[]) : [];
    const result = processReputationActions(npcs, data.actions);
    const sessionChat = await patchChatMetadata(data.chatId, { gameNpcs: result.npcs });
    return { npcs: result.npcs, changes: result.changes, sessionChat };
  },

  async addJournalEntry(data: {
    chatId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<{ journal: Journal; sessionChat: Chat }> {
    const chat = await getChat(data.chatId);
    const journal = applyJournalEntry(journalFromMeta(chatMeta(chat)), data.type, data.data);
    const sessionChat = await patchChatMetadata(data.chatId, { gameJournal: journal });
    return { journal, sessionChat };
  },

  async getJournal(chatId: string): Promise<GameJournalResponse> {
    const meta = chatMeta(await getChat(chatId));
    const journal = journalFromMeta(meta);
    const sessionNumber = Number(meta.gameSessionNumber ?? 1);
    return {
      journal,
      recap: buildStructuredRecap(journal, sessionNumber),
      playerNotes: typeof meta.gamePlayerNotes === "string" ? meta.gamePlayerNotes : "",
    };
  },

  async updateNotes(chatId: string, notes: string) {
    const sessionChat = await patchChatMetadata(chatId, { gamePlayerNotes: notes });
    return { ok: true, sessionChat };
  },

  async listCheckpoints(chatId: string) {
    const all = await storageApi.list<GameCheckpoint>("game-checkpoints");
    return all.filter((checkpoint) => (checkpoint as { chatId?: string }).chatId === chatId);
  },

  async createCheckpoint(data: { chatId: string; label: string; triggerType: string }) {
    const chat = await getChat(data.chatId);
    const snapshot = await storageApi.create<{ id: string }>("game-state-snapshots", {
      chatId: data.chatId,
      messageId: null,
      gameState: (chat as { gameState?: unknown }).gameState ?? {},
      metadata: chatMeta(chat),
    });
    const record = await storageApi.create<{ id: string }>("game-checkpoints", {
      chatId: data.chatId,
      snapshotId: snapshot.id,
      messageId: "",
      label: data.label || "Checkpoint",
      triggerType: data.triggerType || "manual",
      location: null,
      gameState: null,
      weather: null,
      timeOfDay: null,
      turnNumber: null,
    });
    return { id: record.id };
  },

  async loadCheckpoint(data: { chatId: string; checkpointId: string }) {
    const checkpoint = await storageApi.get<{ id: string; chatId?: string; label?: string; snapshotId?: string }>(
      "game-checkpoints",
      data.checkpointId,
    );
    if (!checkpoint) throw new Error("Checkpoint was not found.");
    if (checkpoint.chatId !== data.chatId) throw new Error("Checkpoint does not belong to this chat.");
    if (!checkpoint.snapshotId) throw new Error("Checkpoint is missing its state snapshot.");
    const snapshot = await storageApi.get<{
      id: string;
      chatId?: string;
      gameState?: unknown;
      metadata?: Record<string, unknown>;
    }>("game-state-snapshots", checkpoint.snapshotId);
    if (!snapshot) throw new Error("Checkpoint snapshot was not found.");
    if (snapshot.chatId !== data.chatId) throw new Error("Checkpoint snapshot does not belong to this chat.");
    await patchChat(data.chatId, {
      gameState: snapshot.gameState ?? {},
      metadata: snapshot.metadata ?? {},
    });
    const message = await createChatMessage(data.chatId, {
      role: "system",
      characterId: null,
      content: `[Checkpoint restored: ${checkpoint.label || "Checkpoint"}]`,
    });
    return { ok: true, messageId: message.id, gameState: snapshot.gameState ?? {}, metadata: snapshot.metadata ?? {} };
  },

  async deleteCheckpoint(id: string) {
    const result = await storageApi.delete("game-checkpoints", id);
    return { ok: Boolean(result.deleted) };
  },

  async partyTurn(input: {
    chatId: string;
    narration: string;
    playerAction?: string;
    connectionId?: string | null;
    debugMode?: boolean;
  }) {
    const meta = chatMeta(await getChat(input.chatId));
    const cards = Array.isArray(meta.gameCharacterCards) ? meta.gameCharacterCards.map(asRecord) : [];
    const names = cards.map((card, index) => gameCardName(card, `Party member ${index + 1}`));
    const partyNames = names.length ? names.join(", ") : "The party";
    const connectionId = input.connectionId?.trim();
    if (!connectionId) {
      throw new Error("Choose a chat connection before asking the party.");
    }
    const raw = await llmApi.complete({
      connectionId,
      messages: [
        {
          role: "system",
          content: buildPartySystemPrompt({
            partyCards: cards.length
              ? cards.map((card, index) => ({
                  name: gameCardName(card, `Party member ${index + 1}`),
                  card: gameCardPromptText(card),
                }))
              : [{ name: partyNames, card: partyNames }],
            playerName:
              typeof meta.gamePlayerName === "string" && meta.gamePlayerName.trim() ? meta.gamePlayerName : "Player",
            gameActiveState: typeof meta.gameActiveState === "string" ? meta.gameActiveState : "exploration",
            partyArcs: Array.isArray(meta.gamePartyArcs) ? (meta.gamePartyArcs as PartyArc[]) : [],
          }),
        },
        {
          role: "user",
          content: `GM narration:\n${input.narration}\n\nPlayer action:\n${input.playerAction ?? ""}\n\nWrite the party's immediate reactions.`,
        },
      ],
      parameters: { temperature: 0.9, maxTokens: 1200 },
    });
    const clean = raw.replace(/\[(?:party-turn|party-chat)\]/gi, "").trim();
    if (!clean || parsePartyDialogue(clean).length === 0) {
      throw new Error("The party response was empty or malformed.");
    }
    const message = await createChatMessage(input.chatId, {
      role: "assistant",
      characterId: null,
      content: `[party-turn]\n${clean}`,
      extra: {},
      swipes: [{ content: `[party-turn]\n${clean}` }],
      activeSwipeIndex: 0,
    });
    mirrorGameMessageToDiscord(meta, clean, "Party");
    return { raw: clean, messageId: typeof message.id === "string" ? message.id : null };
  },

  async initCombatEncounter(input: {
    chatId: string;
    connectionId?: string | null;
    settings?: EncounterSettings | null;
    spellbookId?: string | null;
  }): Promise<{ combatState: CombatInitState }> {
    const meta = chatMeta(await getChat(input.chatId));
    const cards = Array.isArray(meta.gameCharacterCards) ? meta.gameCharacterCards.map(asRecord) : [];
    const defaultAttack: CombatAttack = {
      name: "Attack",
      type: "single-target",
      description: "A basic attack.",
      power: 1,
      cooldown: 0,
    };
    const fallbackPartyMember = (name: string, isPlayer: boolean): CombatPartyMember => ({
      name,
      hp: 24,
      maxHp: 24,
      attacks: [defaultAttack],
      items: ["Healing Potion x1"],
      statuses: [],
      isPlayer,
    });

    const party: CombatPartyMember[] = [];
    if (cards[0]) {
      const rpg = asRecord(cards[0].rpgStats);
      const hp = Number(asRecord(rpg.hp).max ?? 24);
      party.push({
        name: typeof cards[0].name === "string" && cards[0].name.trim() ? cards[0].name : "Player",
        hp: Number.isFinite(hp) && hp > 0 ? hp : 24,
        maxHp: Number.isFinite(hp) && hp > 0 ? hp : 24,
        attacks: [defaultAttack],
        items: Array.isArray(meta.gameInventory)
          ? (meta.gameInventory as unknown[]).map(String).filter(Boolean)
          : ["Healing Potion x1"],
        statuses: [],
        isPlayer: true,
      });
    }
    for (const card of cards.slice(1, 4)) {
      party.push(fallbackPartyMember(typeof card.name === "string" && card.name.trim() ? card.name : "Ally", false));
    }
    if (party.length === 0) party.push(fallbackPartyMember("Player", true));

    const settings = asRecord(input.settings);
    const enemyCount = Math.max(1, Math.min(6, Number(settings.enemyCount ?? settings.enemies ?? 1) || 1));
    const enemies: CombatEnemy[] = Array.from({ length: enemyCount }, (_, index) => ({
      name: `Enemy ${index + 1}`,
      hp: 18,
      maxHp: 18,
      attacks: [{ ...defaultAttack, name: "Strike", description: "A direct attack." }],
      statuses: [],
      description: "A hostile combatant.",
      sprite: "enemy",
    }));
    const map = asRecord(meta.gameMap);
    return {
      combatState: {
        party,
        enemies,
        environment: typeof map.name === "string" && map.name.trim() ? map.name : "the current area",
        styleNotes: {
          environmentType: "plains",
          atmosphere: "tense",
          timeOfDay: "day",
          weather: "clear",
        },
        itemEffects: [
          {
            name: "Healing Potion",
            target: "ally",
            type: "heal",
            description: "Restores a moderate amount of health.",
            power: 0.3,
            consumes: true,
          },
        ],
        dialogueCues: [],
        mechanics: [],
        visuals: { isBossFight: false, enemyImagePrompts: [] },
      },
    };
  },

  async spotifyCandidates(payload: Record<string, unknown>) {
    try {
      return await spotifyApi.searchTracks({
        query: spotifyQuery(payload),
        limit: Math.max(1, Math.min(50, Number(payload.limit ?? 50))),
        recentTrackUris: recentSpotifyTracks(payload),
      });
    } catch (error) {
      return { enabled: false, tracks: [], error: error instanceof Error ? error.message : "Spotify search failed" };
    }
  },

  async spotifyPlay(payload: { track: unknown; deviceId?: string | null }) {
    return spotifyApi.playTrack(payload as Record<string, unknown>);
  },

  async previewGeneratedAssets(payload: GameAssetGenerationPayload): Promise<{ items: GameImagePromptReviewItem[] }> {
    const record = payload as unknown as Record<string, unknown>;
    const meta = chatMeta(await getChat(String(record.chatId)));
    const setup = asRecord(meta.gameSetupConfig);
    const artStyle =
      (typeof record.artStylePrompt === "string" && record.artStylePrompt) ||
      (typeof setup.artStylePrompt === "string" && setup.artStylePrompt) ||
      "";
    const promptSettings = imagePromptSettings(record);
    const items: GameImagePromptReviewItem[] = [];
    if (typeof record.backgroundTag === "string" && record.backgroundTag.trim()) {
      const id = imageReviewId("background", record.backgroundTag);
      const defaultPrompt = sceneAssetPrompt(
        "background",
        record.backgroundTag,
        record.backgroundTag,
        artStyle,
        promptSettings,
      );
      items.push({
        id,
        kind: "background",
        title: `Background: ${record.backgroundTag}`,
        prompt:
          promptOverride(record, id) ??
          (await registeredGameImagePrompt(GAME_BACKGROUND_PROMPT_OVERRIDE, {
            defaultPrompt,
            label: record.backgroundTag,
            detail: record.backgroundTag,
            artStyle,
            promptSettings,
          })),
        width: imageSize(record, "background", "width", 1280),
        height: imageSize(record, "background", "height", 720),
      });
    }
    const illustration = asRecord(record.illustration);
    if (Object.keys(illustration).length > 0) {
      const label =
        (typeof illustration.reason === "string" && illustration.reason) ||
        (typeof illustration.slug === "string" && illustration.slug) ||
        (typeof illustration.prompt === "string" && illustration.prompt) ||
        "Scene illustration";
      const id = imageReviewId("illustration", label);
      const detail = String(illustration.prompt ?? label);
      const defaultPrompt = sceneAssetPrompt("illustration", label, detail, artStyle, promptSettings);
      items.push({
        id,
        kind: "illustration",
        title: `Illustration: ${label}`,
        prompt:
          promptOverride(record, id) ??
          (await registeredGameImagePrompt(GAME_ILLUSTRATION_PROMPT_OVERRIDE, {
            defaultPrompt,
            label,
            detail,
            artStyle,
            promptSettings,
          })),
        width: imageSize(record, "background", "width", 1280),
        height: imageSize(record, "background", "height", 720),
      });
    }
    const npcs = Array.isArray(record.npcsNeedingAvatars) ? record.npcsNeedingAvatars : [];
    for (const npc of npcs.slice(0, 10)) {
      const npcRecord = asRecord(npc);
      const name = typeof npcRecord.name === "string" && npcRecord.name.trim() ? npcRecord.name : "NPC";
      const detail =
        typeof npcRecord.description === "string" && npcRecord.description.trim()
          ? npcRecord.description
          : "distinctive character portrait";
      const id = imageReviewId("portrait", name);
      const defaultPrompt = sceneAssetPrompt("portrait", name, detail, artStyle, promptSettings);
      items.push({
        id,
        kind: "portrait",
        title: `Portrait: ${name}`,
        prompt:
          promptOverride(record, id) ??
          (await registeredGameImagePrompt(GAME_PORTRAIT_PROMPT_OVERRIDE, {
            defaultPrompt,
            label: name,
            detail,
            artStyle,
            promptSettings,
          })),
        width: imageSize(record, "portrait", "width", 768),
        height: imageSize(record, "portrait", "height", 1024),
      });
    }
    return { items };
  },

  async generateAssets(payload: GameAssetGenerationPayload, signal?: AbortSignal): Promise<GameAssetGenerationResult> {
    const record = payload as unknown as Record<string, unknown>;
    const chatId = String(record.chatId);
    const chat = await getChat(chatId);
    const meta = chatMeta(chat);
    let sessionChat = chat;
    if (!meta.enableSpriteGeneration) {
      return {
        generatedBackground: null,
        fallbackBackground: null,
        generatedIllustration: null,
        generatedNpcAvatars: [],
        sessionChat,
      };
    }
    const imageConnectionId =
      (typeof record.imageConnectionId === "string" && record.imageConnectionId) ||
      (typeof meta.gameImageConnectionId === "string" && meta.gameImageConnectionId) ||
      (typeof meta.imageConnectionId === "string" && meta.imageConnectionId) ||
      (typeof asRecord(meta.gameSetupConfig).imageConnectionId === "string" &&
        (asRecord(meta.gameSetupConfig).imageConnectionId as string));
    if (!imageConnectionId) throw new Error("Game image generation requires an image connection.");

    const preview = await gameApi.previewGeneratedAssets(payload);
    let generatedBackground: string | null = null;
    let generatedIllustration: GameAssetGenerationResult["generatedIllustration"] = null;
    const generatedNpcAvatars: GameAssetGenerationResult["generatedNpcAvatars"] = [];

    for (const item of preview.items) {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      const image = await imageGenerationApi.generate<{ base64: string; mimeType: string; image?: string }>({
        connectionId: imageConnectionId,
        prompt: item.prompt,
        width: item.width,
        height: item.height,
      });
      if (item.kind === "background") {
        const key = typeof record.backgroundTag === "string" ? record.backgroundTag : "generated-background";
        const tag = await uploadGeneratedAsset(
          "backgrounds",
          "generated",
          generatedAssetSlug(key),
          image.base64,
          image.mimeType,
        );
        generatedBackground = tag;
        sessionChat = await patchChatMetadata(chatId, { gameSceneBackground: tag });
      } else if (item.kind === "illustration") {
        const illustration = asRecord(record.illustration);
        const key = (typeof illustration.slug === "string" && illustration.slug) || item.title || "scene-illustration";
        const tag = await uploadGeneratedAsset(
          "backgrounds",
          "illustrations",
          generatedAssetSlug(key),
          image.base64,
          image.mimeType,
        );
        generatedIllustration = {
          tag,
          ...(Number.isInteger(illustration.segment) ? { segment: illustration.segment as number } : {}),
        };
      } else if (item.kind === "portrait") {
        generatedNpcAvatars.push({
          name: item.title.replace(/^Portrait:\s*/, "") || "NPC",
          avatarUrl: image.image ?? `data:${image.mimeType};base64,${image.base64}`,
        });
      }
    }

    if (generatedNpcAvatars.length > 0) {
      const freshMeta = chatMeta(await getChat(chatId));
      const npcs = Array.isArray(freshMeta.gameNpcs) ? [...(freshMeta.gameNpcs as GameNpc[])] : [];
      for (const avatar of generatedNpcAvatars) {
        const existing = npcs.find((npc) => npc.name.toLowerCase() === avatar.name.toLowerCase());
        if (existing) {
          (existing as GameNpc & { avatarUrl?: string }).avatarUrl = avatar.avatarUrl;
        } else {
          npcs.push({
            id: newId("npc"),
            emoji: "👤",
            name: avatar.name,
            description: "",
            location: "",
            reputation: 0,
            met: true,
            notes: [],
            avatarUrl: avatar.avatarUrl,
          } as GameNpc);
        }
      }
      sessionChat = await patchChatMetadata(chatId, { gameNpcs: npcs });
    }

    return { generatedBackground, fallbackBackground: null, generatedIllustration, generatedNpcAvatars, sessionChat };
  },
};

export async function applyGameJsonRepair(request: JsonRepairRequest, rawJson: string): Promise<unknown> {
  const repaired = parseJsonObject(rawJson);
  if (!repaired) {
    throw new Error("Repaired JSON is not a JSON object.");
  }
  const body = asRecord(request.applyBody);
  const chatId = typeof body.chatId === "string" ? body.chatId : "";
  const connectionId = typeof body.connectionId === "string" ? body.connectionId : undefined;
  const kind = typeof request.kind === "string" ? request.kind : "";

  if (!chatId) throw new Error("JSON repair request is missing its target chat.");

  switch (kind) {
    case "game_setup":
      return gameApi.setupGame({
        chatId,
        connectionId,
        preferences: typeof body.preferences === "string" ? body.preferences : "",
        setupConfig: isGameSetupConfig(body.setupConfig) ? body.setupConfig : undefined,
        setup: repaired,
      });
    case "game_map":
      return gameApi.generateMap({
        chatId,
        connectionId,
        locationType: typeof body.locationType === "string" ? body.locationType : "Area",
        context: typeof body.context === "string" ? body.context : "",
        generated: repaired,
      });
    case "session_conclusion":
      return gameApi.concludeSession({
        chatId,
        connectionId,
        nextSessionRequest: typeof body.nextSessionRequest === "string" ? body.nextSessionRequest : undefined,
        generated: repaired,
      });
    case "session_lorebook":
      return gameApi.regenerateSessionLorebook({
        chatId,
        connectionId,
        sessionNumber: Number(body.sessionNumber ?? 1),
        generated: repaired,
      });
    case "campaign_progression":
      return gameApi.updateCampaignProgression({
        chatId,
        connectionId,
        sessionNumber: Number(body.sessionNumber ?? 1),
        generated: repaired,
      });
    default:
      throw new Error("Unsupported game JSON repair request.");
  }
}
