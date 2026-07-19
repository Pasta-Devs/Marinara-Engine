import {
  GAME_GM_BUILT_IN_PROMPT_TEMPLATES,
  normalizeAgentPromptTemplateOptions,
  normalizeTextForMatch,
  resolveGameSetupArtStylePrompt,
  type GameActiveState,
  type GameCampaignPlan,
  type GameMap,
  type GameNpc,
  type SessionSummary,
} from "@marinara-engine/shared";
import { buildGmSystemPrompt, type GmPromptContext } from "../game/gm-prompts.js";
import { listPartySprites } from "../game/sprite.service.js";
import { generatePerceptionHints, formatPerceptionHints, type PerceptionContext } from "../game/perception.service.js";
import { getMoraleTier, formatMoraleContext } from "../game/morale.service.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";
import { isInferenceAvailable as isSidecarInferenceAvailable } from "../sidecar/sidecar-inference.service.js";
import { cardPromptText } from "./generation-text-utils.js";
import { buildPartyNpcId, isPartyNpcId } from "./game-party-utils.js";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
  getPersona(id: string): Promise<any | null>;
};

type ChatsStore = {
  getById(id: string): Promise<{ metadata?: unknown } | null>;
  updateMetadata(chatId: string, metadata: Record<string, unknown>): Promise<unknown>;
};

type ChatLike = {
  personaId?: string | null;
};

export type GameGmPromptRuntime = {
  gmCtx: GmPromptContext;
  gameActiveState: string;
  sessionNumber: number;
  gameTurnNumber: number;
  gameTime: string | undefined;
  gameMap: GameMap | null;
  hasSceneModel: boolean;
};

function parseExtra(extra: unknown): Record<string, unknown> {
  if (!extra) return {};
  try {
    return typeof extra === "string" ? JSON.parse(extra) : (extra as Record<string, unknown>);
  } catch {
    return {};
  }
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function resolveGameGmPromptTemplate(
  chatMetadata: Record<string, unknown>,
  setupConfig?: Record<string, unknown> | null,
): string | null {
  const explicitPrompt =
    typeof chatMetadata.gameSystemPrompt === "string" ? chatMetadata.gameSystemPrompt.trim() : "";
  if (explicitPrompt) return explicitPrompt;

  const selectedId =
    typeof chatMetadata.gameGmPromptTemplateId === "string" && chatMetadata.gameGmPromptTemplateId.trim()
      ? chatMetadata.gameGmPromptTemplateId.trim()
      : typeof setupConfig?.gameGmPromptTemplateId === "string"
        ? setupConfig.gameGmPromptTemplateId.trim()
        : "";
  if (!selectedId) return null;

  const options = [
    ...GAME_GM_BUILT_IN_PROMPT_TEMPLATES,
    ...normalizeAgentPromptTemplateOptions(chatMetadata.gameGmPromptTemplates),
  ];
  return options.find((option) => option.id === selectedId)?.promptTemplate.trim() || null;
}

function appendGameCardDetails(parts: string[], card: Record<string, unknown> | undefined): void {
  if (!card) return;
  if (card.class) parts.push(`Class: ${card.class}`);
  if ((card.abilities as string[])?.length) parts.push(`Abilities: ${(card.abilities as string[]).join(", ")}`);
  if ((card.strengths as string[])?.length) parts.push(`Strengths: ${(card.strengths as string[]).join(", ")}`);
  if ((card.weaknesses as string[])?.length) parts.push(`Weaknesses: ${(card.weaknesses as string[]).join(", ")}`);
  const extra = card.extra as Record<string, string> | undefined;
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      parts.push(`${key}: ${value}`);
    }
  }
}

function buildLibraryCardParts(data: any, fallbackName = "Unknown"): { name: string; parts: string[] } {
  const name = data.name || fallbackName;
  const parts = [`Name: ${name}`];
  const personality = cardPromptText(data.personality);
  const description = cardPromptText(data.description);
  const backstory = cardPromptText(data.extensions?.backstory || data.backstory);
  const appearance = cardPromptText(data.extensions?.appearance || data.appearance);
  const systemPrompt = cardPromptText(data.system_prompt);
  if (description) parts.push(`Description: ${description}`);
  if (personality) parts.push(`Personality: ${personality}`);
  if (backstory) parts.push(`Backstory: ${backstory}`);
  if (appearance) parts.push(`Appearance: ${appearance}`);
  if (systemPrompt) parts.push(`Character System Instructions: ${systemPrompt}`);
  return { name, parts };
}

export async function injectGameGmPromptRuntime(args: {
  messages: PromptMessage[];
  chatId: string;
  chat: ChatLike;
  chatMetadata: Record<string, unknown>;
  characterIds: string[];
  chars: CharactersStore;
  chats: ChatsStore;
  selectedGameStateSnapshotPromise: Promise<any | null>;
  mappedMessages: Array<{ role: string }>;
  personaName: string;
  resolvePromptMacros(value: string): string;
}): Promise<GameGmPromptRuntime> {
  const setupConfig =
    args.chatMetadata.gameSetupConfig &&
    typeof args.chatMetadata.gameSetupConfig === "object" &&
    !Array.isArray(args.chatMetadata.gameSetupConfig)
      ? (args.chatMetadata.gameSetupConfig as Record<string, unknown>)
      : null;
  const gameActiveState = (args.chatMetadata.gameActiveState as string) || "exploration";
  const sessionNumber = (args.chatMetadata.gameSessionNumber as number) || 1;
  const storyArc = (args.chatMetadata.gameStoryArc as string) || null;
  const plotTwists = Array.isArray(args.chatMetadata.gamePlotTwists)
    ? (args.chatMetadata.gamePlotTwists as string[])
    : null;
  const gameBlueprint =
    args.chatMetadata.gameBlueprint &&
    typeof args.chatMetadata.gameBlueprint === "object" &&
    !Array.isArray(args.chatMetadata.gameBlueprint)
      ? (args.chatMetadata.gameBlueprint as { campaignPlan?: GameCampaignPlan; hudWidgets?: unknown })
      : null;
  const gameMap = (args.chatMetadata.gameMap as GameMap) || null;
  const gameNpcs = Array.isArray(args.chatMetadata.gameNpcs) ? (args.chatMetadata.gameNpcs as GameNpc[]) : [];
  const sessionSummaries = Array.isArray(args.chatMetadata.gamePreviousSessionSummaries)
    ? (args.chatMetadata.gamePreviousSessionSummaries as SessionSummary[])
    : [];
  const playerNotes =
    typeof args.chatMetadata.gamePlayerNotes === "string" ? args.chatMetadata.gamePlayerNotes.trim() : undefined;

  let gmCharacterCard: string | null = null;
  const gmCharId = args.chatMetadata.gameGmCharacterId as string | null;
  if (gmCharId) {
    try {
      const gmChar = await args.chars.getById(gmCharId);
      if (gmChar) {
        const gmData = parseMaybeJson(gmChar.data) as any;
        const { parts } = buildLibraryCardParts(gmData);
        gmCharacterCard = parts.join("\n");
      }
    } catch {
      /* ignore */
    }
  }

  const partyCharIds = Array.isArray(args.chatMetadata.gamePartyCharacterIds)
    ? (args.chatMetadata.gamePartyCharacterIds as string[])
    : args.characterIds;
  const partyNames: string[] = [];
  const partyCards: Array<{ name: string; card: string }> = [];
  const partyIdNamePairs: Array<{ id: string; name: string }> = [];
  const gameCharCards = Array.isArray(args.chatMetadata.gameCharacterCards)
    ? (args.chatMetadata.gameCharacterCards as Array<Record<string, unknown>>)
    : [];
  const gameCardByName = new Map<string, Record<string, unknown>>();
  for (const card of gameCharCards) {
    if (card.name) gameCardByName.set(normalizeTextForMatch(card.name), card);
  }

  for (const pcId of partyCharIds) {
    try {
      const pc = await args.chars.getById(pcId);
      if (pc) {
        const pcData = parseMaybeJson(pc.data) as any;
        const { name, parts } = buildLibraryCardParts(pcData);
        partyNames.push(name);
        partyIdNamePairs.push({ id: pcId, name });
        appendGameCardDetails(parts, gameCardByName.get(normalizeTextForMatch(name)));
        partyCards.push({ name, card: parts.join("\n") });
      }
    } catch {
      /* ignore */
    }
  }

  for (const npcId of partyCharIds) {
    if (!isPartyNpcId(npcId)) continue;
    const npc = gameNpcs.find((candidate) => buildPartyNpcId(candidate.name) === npcId);
    if (!npc) continue;
    const name = npc.name || "Unknown";
    partyNames.push(name);
    partyIdNamePairs.push({ id: npcId, name });
    const parts = [`Name: ${name}`, "Source: Tracked NPC companion, not a character-library card"];
    if (npc.description) parts.push(`Description: ${npc.description}`);
    if (npc.location) parts.push(`Last Known Location: ${npc.location}`);
    if (npc.notes?.length) parts.push(`Notes: ${npc.notes.join("; ")}`);
    appendGameCardDetails(parts, gameCardByName.get(normalizeTextForMatch(name)));
    partyCards.push({ name, card: parts.join("\n") });
  }

  let playerCard: string | null = null;
  const playerPersonaId = (args.chat.personaId || setupConfig?.personaId) as string | null | undefined;
  if (playerPersonaId) {
    try {
      const persona = await args.chars.getPersona(playerPersonaId);
      if (persona) {
        const parts = [`Name: ${persona.name}`];
        const description = cardPromptText(persona.description);
        const personality = cardPromptText(persona.personality);
        const backstory = cardPromptText(persona.backstory);
        const appearance = cardPromptText(persona.appearance);
        if (description) parts.push(`Description: ${description}`);
        if (personality) parts.push(`Personality: ${personality}`);
        if (backstory) parts.push(`Backstory: ${backstory}`);
        if (appearance) parts.push(`Appearance: ${appearance}`);
        appendGameCardDetails(parts, gameCardByName.get(normalizeTextForMatch(persona.name)));
        playerCard = parts.join("\n");
      }
    } catch {
      /* ignore */
    }
  }

  let weatherContext: string | undefined;
  let gameTime: string | undefined;
  try {
    const snap = await args.selectedGameStateSnapshotPromise;
    if (snap) {
      if (snap.weather)
        weatherContext = `Current weather: ${snap.weather}${snap.temperature ? `, ${snap.temperature}` : ""}`;
      if (snap.time || snap.date) gameTime = [snap.date, snap.time].filter(Boolean).join(", ");
    }
  } catch {
    /* ignore */
  }

  const sceneConnectionId = (setupConfig?.sceneConnectionId as string) || null;
  const sidecarCfg = sidecarModelService.getConfig();
  const sidecarHandlesScene = sidecarCfg.useForGameScene && (await isSidecarInferenceAvailable());
  const hasSceneModel = !!sceneConnectionId || sidecarHandlesScene;
  const gameTurnNumber = args.mappedMessages.filter((message) => message.role === "user").length + 1;

  const lastMapPos = args.chatMetadata.lastMapPosition as string | { x: number; y: number } | undefined;
  const currentMapPos = gameMap?.partyPosition;
  const playerMoved = !lastMapPos || !currentMapPos || JSON.stringify(lastMapPos) !== JSON.stringify(currentMapPos);
  if (currentMapPos && JSON.stringify(lastMapPos) !== JSON.stringify(currentMapPos)) {
    args.chatMetadata.lastMapPosition = currentMapPos;
    const freshChat = await args.chats.getById(args.chatId);
    const freshMeta = freshChat ? parseExtra(freshChat.metadata) : args.chatMetadata;
    await args.chats.updateMetadata(args.chatId, { ...freshMeta, lastMapPosition: currentMapPos });
  }

  let perceptionHintsBlock: string | undefined;
  try {
    const latestSnapshot = await args.selectedGameStateSnapshotPromise;
    const parsedPlayerStats = latestSnapshot?.playerStats ? parseMaybeJson(latestSnapshot.playerStats) : null;
    const playerStats =
      parsedPlayerStats && typeof parsedPlayerStats === "object" && !Array.isArray(parsedPlayerStats)
        ? (parsedPlayerStats as Record<string, any>)
        : null;
    if (playerStats) {
      const parsedPresentCharacters = latestSnapshot?.presentCharacters
        ? parseMaybeJson(latestSnapshot.presentCharacters)
        : null;
      const presentNpcs = Array.isArray(parsedPresentCharacters)
        ? parsedPresentCharacters
            .map((character: { name?: string }) => character.name)
            .filter((name): name is string => typeof name === "string" && name.length > 0)
        : [];
      const perceptionContext: PerceptionContext = {
        perceptionMod: playerStats.skills?.Perception ?? playerStats.skills?.perception ?? 0,
        wisdomScore: playerStats.attributes?.wis ?? 10,
        gameState: gameActiveState,
        location: latestSnapshot?.location ?? null,
        weather: latestSnapshot?.weather ?? null,
        timeOfDay: latestSnapshot?.time ?? null,
        presentNpcNames: presentNpcs,
      };
      const hints = generatePerceptionHints(perceptionContext);
      if (hints.length > 0) {
        perceptionHintsBlock = formatPerceptionHints(hints);
      }
    }
  } catch {
    /* non-fatal */
  }

  const gmCtx: GmPromptContext = {
    gameActiveState: gameActiveState as GameActiveState,
    storyArc,
    plotTwists,
    map: gameMap,
    npcs: gameNpcs,
    sessionSummaries,
    sessionNumber,
    partyNames,
    partyCards,
    playerName: args.personaName,
    playerCard,
    gmCharacterCard,
    difficulty: (setupConfig?.difficulty as string) || "normal",
    // Effective combat style: runtime drawer override wins, then the wizard
    // choice, then "classic" for legacy games created before this setting.
    combatStyle:
      (args.chatMetadata.gameCombatStyle as string) || (setupConfig?.combatStyle as string) || "classic",
    genre: (setupConfig?.genre as string) || "fantasy",
    setting: (setupConfig?.setting as string) || "original",
    tone: (setupConfig?.tone as string) || "balanced",
    rating: (setupConfig?.rating as "sfw" | "nsfw") || "sfw",
    campaignPlan: gameBlueprint?.campaignPlan ?? null,
    canGenerateBackgrounds:
      !!args.chatMetadata.enableSpriteGeneration &&
      args.chatMetadata.gameImageAutoGenerationEnabled !== false &&
      args.chatMetadata.gameStoryboardViewerDisplayMode !== "background" &&
      !!args.chatMetadata.gameImageConnectionId,
    artStylePrompt: resolveGameSetupArtStylePrompt(setupConfig) || undefined,
    gameTime,
    weatherContext,
    playerNotes,
    hudWidgets: Array.isArray(args.chatMetadata.gameWidgetState)
      ? (args.chatMetadata.gameWidgetState as any[])
      : Array.isArray(gameBlueprint?.hudWidgets)
        ? (gameBlueprint.hudWidgets as any[])
        : undefined,
    hasSceneModel,
    playerMoved,
    turnNumber: gameTurnNumber,
    perceptionHints: perceptionHintsBlock,
    moraleContext: (() => {
      const morale = (args.chatMetadata.gameMorale as number) ?? 50;
      const tier = getMoraleTier(morale);
      return formatMoraleContext({ value: morale, tier });
    })(),
    characterSprites: listPartySprites(partyIdNamePairs),
    language: (setupConfig?.language as string) || undefined,
    gameSystemPrompt: resolveGameGmPromptTemplate(args.chatMetadata, setupConfig),
    gameSpecialInstructions:
      typeof args.chatMetadata.gameSpecialInstructions === "string"
        ? args.chatMetadata.gameSpecialInstructions.trim()
        : null,
  };

  const builtGmPrompt = buildGmSystemPrompt(gmCtx);
  const customGmPrompt =
    typeof args.chatMetadata.customGmPrompt === "string" ? args.chatMetadata.customGmPrompt.trim() : "";
  let fullGmPrompt = customGmPrompt ? `${builtGmPrompt}\n\n${customGmPrompt}` : builtGmPrompt;
  fullGmPrompt = args.resolvePromptMacros(fullGmPrompt);

  const sysIdx = args.messages.findIndex((message) => message.role === "system");
  if (sysIdx >= 0) {
    args.messages[sysIdx] = { role: "system", content: fullGmPrompt };
  } else {
    args.messages.unshift({ role: "system", content: fullGmPrompt });
  }

  return {
    gmCtx,
    gameActiveState,
    sessionNumber,
    gameTurnNumber,
    gameTime,
    gameMap,
    hasSceneModel,
  };
}
