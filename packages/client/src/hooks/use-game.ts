// ──────────────────────────────────────────────
// Hook: Game Mode API
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError, api, isJsonRepairApiError } from "../lib/api-client";
import { captureChatMetadataVersion, chatKeys, guardServerChatSnapshot } from "./use-chats";
import { lorebookKeys } from "./use-lorebooks";
import {
  clearPendingHudWidgetPersist,
  getHudWidgetStateSignature,
  getPendingHudWidgetPersistenceSignature,
  registerPendingHudWidgetPersistence,
  useGameModeStore,
} from "../stores/game-mode.store";
export { patchChatMetadata } from "../lib/chat-metadata-patch";
import { patchChatMetadata } from "../lib/chat-metadata-patch";
import { useGameAssetStore } from "../stores/game-asset.store";
import { useGameStateStore } from "../stores/game-state.store";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";
import type {
  GameActiveState,
  GameMap,
  GameInitialSetupLabels,
  GameSetupConfig,
  GameNpc,
  DiceRollResult,
  SessionSummary,
  Combatant,
  CombatWeather,
  CombatRoundResult,
  CombatPlayerAction,
  HudWidget,
  GameBlueprint,
  TacticalCombatState,
  TacticalBattlefieldBrief,
  TacticalAction,
  TacticalEvent,
  RPGStatPool,
} from "@marinara-engine/shared";
import type {
  Chat,
  GameDungeonMap,
  GameDungeonWalk,
  GameWorld,
  WorldJournal,
  WorldRoute,
  WorldInterior,
  WorldTown,
  WorldTownVisit,
  WorldWalk,
} from "@marinara-engine/shared";
import { isJsonRecord } from "@marinara-engine/shared";

// ── Query Keys ──

export const gameKeys = {
  all: ["game"] as const,
  sessions: (gameId: string) => [...gameKeys.all, "sessions", gameId] as const,
  overworld: (chatId: string) => [...gameKeys.all, "overworld", chatId] as const,
  world: (chatId: string) => [...gameKeys.all, "world", chatId] as const,
  town: (chatId: string) => [...gameKeys.all, "town", chatId] as const,
  worldJournal: (chatId: string) => [...gameKeys.all, "world-journal", chatId] as const,
  dungeonMap: (chatId: string) => [...gameKeys.all, "dungeon-map", chatId] as const,
};

// ── Types ──

interface CreateGameResponse {
  sessionChat: Chat;
  gameId: string;
}

interface SetupResponse {
  setup: Record<string, unknown>;
  worldOverview: string | null;
  gameNpcs?: GameNpc[];
}

interface StartGameResponse {
  status: string;
  /**
   * True when the server detected that a GM turn already exists for this chat
   * (race recovery — see #821). Callers must skip generating another initial
   * turn in this case; the existing intro is already saved.
   */
  alreadyStarted?: boolean;
}

interface StartSessionResponse {
  sessionChat: Chat;
  sessionNumber: number;
  recap: string;
}

interface ConcludeSessionResponse {
  summary: SessionSummary;
}

interface RegenerateSessionConclusionResponse {
  summary: SessionSummary;
}

interface RegenerateSessionLorebookResponse {
  sessionNumber: number;
  lorebookId: string;
  entryCount: number;
}

interface UpdateCampaignProgressionResponse {
  sessionChat: Chat;
  gameId: string;
  campaignProgression: {
    storyArc: string | null;
    plotTwists: string[];
    partyArcs: unknown[];
  };
}

export interface PartyCardChoice {
  id: string;
  name: string;
  title: string | null;
  avatarPath: string | null;
  avatarCrop: unknown;
  /** The card's library preview text, shown when it has no title. */
  summary: string | null;
}

interface RecruitPartyMemberResponse {
  sessionChat: Chat;
  added: boolean;
  characterName: string;
  cardCreated: boolean;
  /** Set when several characters share the name: nothing changed, and the player picks one. */
  cardChoices?: PartyCardChoice[];
}

interface RegenerateCharacterSheetResponse {
  characterName: string;
  gameCard: {
    name: string;
    shortDescription: string;
    class: string;
    abilities: string[];
    strengths: string[];
    weaknesses: string[];
    extra: Record<string, string>;
    rpgStats?: {
      attributes: Array<{ name: string; value: number }>;
      hp: { value: number; max: number };
      pools?: RPGStatPool[];
    };
  };
}

interface RemovePartyMemberResponse {
  sessionChat: Chat;
  removed: boolean;
  characterName: string;
}

interface DiceRollResponse {
  result: DiceRollResult;
}

interface StateTransitionResponse {
  previousState: GameActiveState;
  newState: GameActiveState;
}

interface MapGenerateResponse {
  map: GameMap;
  maps?: GameMap[];
  activeGameMapId?: string | null;
}

interface MapMoveResponse {
  map: GameMap;
  maps?: GameMap[];
  activeGameMapId?: string | null;
}

interface UpdateGameWidgetsResponse {
  ok: boolean;
}

// Mirror a guarded snapshot into the active-chat store when it targets the
// active chat: several game surfaces read useChatStore.activeChat directly,
// and ChatArea only re-syncs it from the detail cache in a later effect —
// without this, that gap serves stale metadata (#5641 review).
function syncActiveChatIfCurrent(chat: Chat) {
  const chatStore = useChatStore.getState();
  // The activeChat fallback only counts when no chat is selected: during a
  // chat switch activeChatId is already the NEW chat while activeChat still
  // holds the old one, and a delayed response for the old chat must not
  // resurrect it into the store.
  if (chatStore.activeChatId === chat.id || (!chatStore.activeChatId && chatStore.activeChat?.id === chat.id)) {
    chatStore.setActiveChat(chat);
  }
}

// ── Mutations ──

/** The layer choices `/game/create` turns a new game down over, in words that say what to do about
 *  it. The server's own message names the layers, but it is written for a log; a player who picked
 *  toggles in the wizard needs to be sent back to them. Any other refusal keeps the server's text. */
const RULESET_LAYER_REFUSAL_KEYS: Readonly<Record<string, string>> = Object.freeze({
  ruleset_layer_unknown: "game.ruleset.setup.layerUnknownRefusal",
  ruleset_layer_conflict: "game.ruleset.setup.layerConflictRefusal",
});

export function useCreateGame() {
  const qc = useQueryClient();
  const store = useGameModeStore;
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: {
      name: string;
      setupConfig: GameSetupConfig;
      preferences?: string;
      shareLabels?: GameInitialSetupLabels;
      connectionId?: string;
      promptPresetId?: string;
      chatId?: string;
    }) => api.post<CreateGameResponse>("/game/create", data),
    onSuccess: (res) => {
      store.getState().setActiveGame(res.gameId, res.sessionChat.id, null);
      store.getState().setSetupActive(true);
      // Collapse sidebar when starting a new game to maximize game area
      useUIStore.getState().setSidebarOpen(false);
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
    onError: (err) => {
      console.error("[createGame] Error:", err);
      const code =
        err instanceof ApiError && isJsonRecord(err.payload) && typeof err.payload.code === "string"
          ? err.payload.code
          : null;
      const layerRefusal = code ? RULESET_LAYER_REFUSAL_KEYS[code] : undefined;
      toast.error(
        layerRefusal
          ? t(layerRefusal)
          : err.message || "Failed to create game. Check the selected connection and try again.",
        { duration: 10000 },
      );
    },
  });
}

export function useGameSetup() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: {
      chatId: string;
      connectionId?: string;
      promptPresetId?: string | null;
      preferences: string;
      keepSetupActive?: boolean;
    }) =>
      api.post<SetupResponse>("/game/setup", {
        chatId: data.chatId,
        connectionId: data.connectionId,
        promptPresetId: data.promptPresetId,
        preferences: data.preferences,
        streaming: useUIStore.getState().enableStreaming,
        debugMode: useUIStore.getState().debugMode,
      }),
    onSuccess: (res, variables) => {
      if (!variables.keepSetupActive) store.getState().setSetupActive(false);
      if (Array.isArray(res.gameNpcs)) {
        store.getState().setNpcs(res.gameNpcs);
      }
      const sessionChatId = store.getState().activeSessionChatId;
      if (sessionChatId) {
        qc.invalidateQueries({ queryKey: chatKeys.detail(sessionChatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messages(sessionChatId) });
      }
    },
    onError: (err) => {
      console.error("[gameSetup] Error:", err);
      if (isJsonRepairApiError(err)) {
        toast.info("The model response needs a quick JSON repair before it can be applied.", { duration: 8000 });
        return;
      }
      toast.error(err.message || "Game setup failed. Try again or use a different model.", { duration: 10000 });
    },
  });
}

export function useStartGame() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string }) => api.post<StartGameResponse>("/game/start", data),
    onSuccess: () => {
      const sessionChatId = store.getState().activeSessionChatId;
      if (sessionChatId) {
        const queryKey = chatKeys.detail(sessionChatId);
        const patched = patchChatMetadata(qc.getQueryData<Chat>(queryKey), { gameSessionStatus: "active" });
        if (patched) {
          qc.setQueryData(queryKey, patched);
          if (useChatStore.getState().activeChatId === sessionChatId) {
            useChatStore.getState().setActiveChat(patched);
          }
        }
        qc.invalidateQueries({ queryKey: chatKeys.detail(sessionChatId) });
      }
    },
    onError: (err) => {
      console.error("[startGame] Error:", err);
    },
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { gameId: string; sourceChatId?: string; connectionId?: string }) =>
      api.post<StartSessionResponse>("/game/session/start", data),
    onMutate: (variables) => {
      toast.loading("Starting the next session and generating recap...", {
        id: `game-session-start:${variables.gameId}`,
      });
    },
    onSuccess: (res, variables) => {
      useGameAssetStore.getState().resetPlaybackState();
      store.getState().setActiveGame(variables.gameId, res.sessionChat.id, null);
      store.getState().setSessionNumber(res.sessionNumber);
      // Deliberately unguarded (#5641): the session chat id is unknown until
      // the response arrives, and a chat being started/switched to has no
      // concurrent local metadata edits to protect.
      qc.setQueryData(chatKeys.detail(res.sessionChat.id), res.sessionChat);
      const chatStore = useChatStore.getState();
      chatStore.setActiveChatId(res.sessionChat.id);
      chatStore.setActiveChat(res.sessionChat);
      toast.success(`Session ${res.sessionNumber} is ready.`, {
        id: `game-session-start:${variables.gameId}`,
      });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: gameKeys.sessions(variables.gameId) });
      qc.invalidateQueries({ queryKey: chatKeys.messages(res.sessionChat.id) });
    },
    onError: (err, variables) => {
      console.error("[startSession] Error:", err);
      toast.error(err.message || "Failed to start the next session.", {
        id: `game-session-start:${variables.gameId}`,
      });
    },
  });
}

export function useConcludeSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chatId: string; connectionId?: string; nextSessionRequest?: string }) =>
      api.post<ConcludeSessionResponse>("/game/session/conclude", {
        ...data,
        streaming: useUIStore.getState().enableStreaming,
      }),
    onMutate: (variables) => {
      console.info("[game/session/conclude] Starting conclude request", variables);
      toast.loading("Ending session and generating summary...", {
        id: `game-session-conclude:${variables.chatId}`,
      });
    },
    onSuccess: (_, variables) => {
      console.info("[game/session/conclude] Conclude request completed", variables);
      toast.success("Session concluded.", {
        id: `game-session-conclude:${variables.chatId}`,
      });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
      // Game Lorebook Keeper finishes in the background after the conclusion
      // response. Refresh the chat at bounded intervals so its running/failure
      // state and retry action appear without requiring a page reload.
      for (const delay of [1_500, 5_000, 15_000, 30_000, 60_000, 120_000]) {
        window.setTimeout(() => {
          void qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
        }, delay);
      }
    },
    onError: (err, variables) => {
      console.error("[game/session/conclude] Error:", err);
      if (isJsonRepairApiError(err)) {
        toast.info("Review the generated session JSON before applying it.", {
          id: `game-session-conclude:${variables.chatId}`,
          duration: 8000,
        });
        return;
      }
      toast.error(err.message || "Failed to end session.", {
        id: `game-session-conclude:${variables.chatId}`,
      });
    },
  });
}

export function useRegenerateSessionConclusion() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chatId: string; sessionNumber: number; connectionId?: string }) =>
      api.post<RegenerateSessionConclusionResponse>("/game/session/regenerate-conclusion", data),
    onMutate: (variables) => {
      toast.loading(`Regenerating session ${variables.sessionNumber} conclusion...`, {
        id: `game-session-regenerate:${variables.chatId}:${variables.sessionNumber}`,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Session ${variables.sessionNumber} conclusion regenerated.`, {
        id: `game-session-regenerate:${variables.chatId}:${variables.sessionNumber}`,
      });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
    onError: (err, variables) => {
      console.error("[game/session/regenerate-conclusion] Error:", err);
      if (isJsonRepairApiError(err)) {
        toast.info("Review the regenerated session JSON before applying it.", {
          id: `game-session-regenerate:${variables.chatId}:${variables.sessionNumber}`,
          duration: 8000,
        });
        return;
      }
      toast.error(err.message || "Failed to regenerate session conclusion.", {
        id: `game-session-regenerate:${variables.chatId}:${variables.sessionNumber}`,
      });
    },
  });
}

export function useRegenerateSessionLorebook() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chatId: string; sessionNumber: number; connectionId?: string }) =>
      api.post<RegenerateSessionLorebookResponse>("/game/session/regenerate-lorebook", {
        ...data,
        streaming: useUIStore.getState().enableStreaming,
      }),
    onMutate: (variables) => {
      toast.loading(`Regenerating session ${variables.sessionNumber} lorebook...`, {
        id: `game-session-lorebook:${variables.chatId}:${variables.sessionNumber}`,
      });
    },
    onSuccess: (result, variables) => {
      toast.success(`Lorebook updated with ${result.entryCount} entr${result.entryCount === 1 ? "y" : "ies"}.`, {
        id: `game-session-lorebook:${variables.chatId}:${variables.sessionNumber}`,
      });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      if (result.lorebookId) {
        qc.invalidateQueries({ queryKey: lorebookKeys.entries(result.lorebookId) });
      }
    },
    onError: (err, variables) => {
      console.error("[game/session/regenerate-lorebook] Error:", err);
      if (isJsonRepairApiError(err)) {
        toast.info("Review the generated lorebook JSON before applying it.", {
          id: `game-session-lorebook:${variables.chatId}:${variables.sessionNumber}`,
        });
        return;
      }
      toast.error(err.message || "Failed to regenerate session lorebook.", {
        id: `game-session-lorebook:${variables.chatId}:${variables.sessionNumber}`,
      });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

export function useUpdateCampaignProgression() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chatId: string; sessionNumber: number; connectionId?: string }) =>
      api.post<UpdateCampaignProgressionResponse>("/game/session/update-campaign-progression", data),
    onMutate: (variables) => {
      toast.loading(`Updating plot arcs from session ${variables.sessionNumber}...`, {
        id: `game-campaign-progression:${variables.chatId}:${variables.sessionNumber}`,
      });
      return { metadataVersion: captureChatMetadataVersion(variables.chatId) };
    },
    onSuccess: (res, variables, context) => {
      const guardedChat = guardServerChatSnapshot(qc, res.sessionChat, context?.metadataVersion ?? 0);
      qc.setQueryData(chatKeys.detail(res.sessionChat.id), guardedChat);
      syncActiveChatIfCurrent(guardedChat);
      toast.success(`Plot arcs updated from session ${variables.sessionNumber}.`, {
        id: `game-campaign-progression:${variables.chatId}:${variables.sessionNumber}`,
      });
      qc.invalidateQueries({ queryKey: chatKeys.detail(res.sessionChat.id) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: gameKeys.sessions(res.gameId) });
    },
    onError: (err, variables) => {
      console.error("[game/session/update-campaign-progression] Error:", err);
      if (isJsonRepairApiError(err)) {
        toast.info("Review the generated plot JSON before applying it.", {
          id: `game-campaign-progression:${variables.chatId}:${variables.sessionNumber}`,
          duration: 8000,
        });
        return;
      }
      toast.error(err.message || "Failed to update plot arcs.", {
        id: `game-campaign-progression:${variables.chatId}:${variables.sessionNumber}`,
      });
    },
  });
}

export function useRecruitPartyMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chatId: string; characterName: string; characterId?: string | null; connectionId?: string }) =>
      api.post<RecruitPartyMemberResponse>("/game/party/recruit", data),
    onMutate: (variables) => ({ metadataVersion: captureChatMetadataVersion(variables.chatId) }),
    onSuccess: (res, variables, context) => {
      const guardedChat = guardServerChatSnapshot(qc, res.sessionChat, context?.metadataVersion ?? 0);
      qc.setQueryData(chatKeys.detail(variables.chatId), guardedChat);
      syncActiveChatIfCurrent(guardedChat);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      if (res.added) {
        toast.success(`${res.characterName} joined the party.`);
      } else if (res.cardCreated) {
        toast.success(`${res.characterName}'s party card was created.`);
      }
    },
    onError: (err) => {
      console.error("[recruitPartyMember] Error:", err);
      toast.error(err.message || "Failed to recruit party member.");
    },
  });
}

export function useRegenerateCharacterSheet() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: {
      chatId: string;
      characterId: string;
      characterName: string;
      connectionId?: string;
      debugMode?: boolean;
    }) => api.post<RegenerateCharacterSheetResponse>("/game/character-sheet/regenerate", data),
    onSuccess: (res) => {
      toast.success(t("game.characterSheet.regenerate.ready", { name: res.characterName }));
    },
    onError: (err) => {
      console.error("[regenerateCharacterSheet] Error:", err);
      toast.error(err.message || t("game.characterSheet.regenerate.error"));
    },
  });
}

export function useRemovePartyMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chatId: string; characterName: string }) =>
      api.post<RemovePartyMemberResponse>("/game/party/remove", data),
    onMutate: (variables) => ({ metadataVersion: captureChatMetadataVersion(variables.chatId) }),
    onSuccess: (res, variables, context) => {
      const guardedChat = guardServerChatSnapshot(qc, res.sessionChat, context?.metadataVersion ?? 0);
      qc.setQueryData(chatKeys.detail(variables.chatId), guardedChat);
      syncActiveChatIfCurrent(guardedChat);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      if (res.removed) {
        toast.success(`${res.characterName} left the party.`);
      }
    },
    onError: (err) => {
      console.error("[removePartyMember] Error:", err);
      toast.error(err.message || "Failed to remove party member.");
    },
  });
}

export function useRollDice() {
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string; notation: string; context?: string }) =>
      api.post<DiceRollResponse>("/game/dice/roll", data),
    onSuccess: (res) => {
      store.getState().setDiceRollResult(res.result);
    },
  });
}

export function useSkillCheck() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      chatId: string;
      skill: string;
      /** Absent only beside `difficulty`, which a ruleset game reads off its own ladder. */
      dc?: number;
      advantage?: boolean;
      disadvantage?: boolean;
      preRolledD20?: number;
      who?: string;
      withAbility?: string;
      threshold?: number;
      bonusDice?: number;
      difficulty?: string;
      explode?: number;
      double?: number;
      reroll?: string;
      messageId?: string;
    }) =>
      api.post<{ result: import("@marinara-engine/shared").SkillCheckResult; updatedContent?: string }>(
        "/game/skill-check",
        data,
      ),
    onSuccess: (res, variables) => {
      if (res.updatedContent) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(variables.chatId) });
      }
    },
  });
}

export function useTransitionGameState() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string; newState: GameActiveState }) =>
      api.post<StateTransitionResponse>("/game/state/transition", data),
    onSuccess: (res, variables) => {
      store.getState().setGameState(res.newState);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

export function useGenerateMap() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string; locationType: string; context: string; connectionId?: string }) =>
      api.post<MapGenerateResponse>("/game/map/generate", data),
    onSuccess: (res, variables) => {
      if (res.maps?.length) {
        store.getState().setMaps(res.maps, res.activeGameMapId);
      } else {
        store.getState().setCurrentMap(res.map);
      }
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

export function useMoveOnMap() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string; position: { x: number; y: number } | string; mapId?: string | null }) =>
      api.post<MapMoveResponse>("/game/map/move", data),
    onSuccess: (res, variables) => {
      if (res.maps?.length) {
        store.getState().setMaps(res.maps, res.activeGameMapId);
      } else {
        store.getState().setCurrentMap(res.map);
      }
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: [...gameKeys.all, "journal", variables.chatId] });
    },
  });
}

export function useUpdateGameWidgets() {
  const qc = useQueryClient();

  return useMutation({
    // `expected`: the widgets a caller opened (the State Editor); the save is refused when they changed since.
    mutationFn: ({ chatId, widgets, expected }: { chatId: string; widgets: HudWidget[]; expected?: unknown }) =>
      api.put<UpdateGameWidgetsResponse>(
        `/game/${chatId}/widgets`,
        expected === undefined ? { widgets } : { widgets, expected },
      ),
    onMutate: (variables) => {
      clearPendingHudWidgetPersist(variables.chatId);
      registerPendingHudWidgetPersistence(variables.chatId, variables.widgets);
    },
    onSuccess: (_, variables) => {
      useGameModeStore.getState().setHudWidgets(variables.widgets);
      const queryKey = chatKeys.detail(variables.chatId);
      const patched = patchChatMetadata(qc.getQueryData<Chat>(queryKey), { gameWidgetState: variables.widgets });
      if (patched) {
        qc.setQueryData(queryKey, patched);
        if (useChatStore.getState().activeChatId === variables.chatId) {
          useChatStore.getState().setActiveChat(patched);
        }
      }
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
    onError: (err) => {
      console.error("[updateGameWidgets] Error:", err);
    },
    onSettled: (_, __, variables) => {
      clearPendingHudWidgetPersist(variables.chatId, getHudWidgetStateSignature(variables.widgets));
    },
  });
}

// ── Queries ──

export function useGameSessions(gameId: string | null) {
  return useQuery({
    queryKey: gameKeys.sessions(gameId ?? ""),
    queryFn: () => api.get<Chat[]>(`/game/${gameId}/sessions`),
    enabled: !!gameId,
    staleTime: 2 * 60_000,
  });
}

// ── Sync hook — reads chat metadata and updates game store ──

function isNumericHudWidgetType(type: HudWidget["type"]) {
  return type === "progress_bar" || type === "gauge" || type === "relationship_meter";
}

function finiteNumber(value: unknown): number | null {
  const raw = typeof value === "string" && value.trim() ? Number(value.trim()) : value;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function normalizeHudWidgets(widgets: readonly HudWidget[]): HudWidget[] {
  return widgets.map((w) => {
    if (isNumericHudWidgetType(w.type)) {
      const max = Math.max(1, finiteNumber(w.config.max) ?? 100);
      const value = finiteNumber(w.config.value) ?? finiteNumber(w.config.startingValue) ?? 0;
      const startingValue = finiteNumber(w.config.startingValue) ?? value;

      if (w.config.max !== max || w.config.value !== value || w.config.startingValue !== startingValue) {
        return {
          ...w,
          config: {
            ...w.config,
            max,
            startingValue,
            value,
          },
        };
      }
    }

    if (w.type === "inventory_grid" && !w.config.contents && Array.isArray((w.config as any).items)) {
      const items = (w.config as any).items as Array<{ name: string; slot?: string | number; quantity?: number }>;
      return {
        ...w,
        config: {
          ...w.config,
          contents: items.map((i) => ({
            name: i.name,
            slot: typeof i.slot === "string" ? i.slot : undefined,
            quantity: i.quantity ?? 1,
          })),
        },
      };
    }
    return w;
  });
}

export function useSyncGameState(activeChatId: string, chatMeta: Record<string, unknown>) {
  const prevChatIdRef = useRef<string | null>(null);

  // Reset game store only when the active chat changes, not on every metadata refetch
  useEffect(() => {
    if (prevChatIdRef.current && prevChatIdRef.current !== activeChatId) {
      useGameModeStore.getState().reset();
    }
    prevChatIdRef.current = activeChatId;
    return () => {
      useGameModeStore.getState().reset();
    };
  }, [activeChatId]);

  // Sync metadata into the game store
  useEffect(() => {
    if (!chatMeta.gameId) return;
    const state = useGameModeStore.getState();
    const activeGameChanged = chatMeta.gameId !== state.activeGameId;
    const activeSessionChanged = activeChatId !== state.activeSessionChatId;

    if (activeGameChanged || activeSessionChanged) {
      useGameModeStore
        .getState()
        .setActiveGame(chatMeta.gameId as string, activeChatId, chatMeta.gamePartyChatId as string | undefined);
      // Auto-collapse the chat sidebar when entering a game to maximize game area
      useUIStore.getState().setSidebarOpen(false);
    }
    if (chatMeta.gameActiveState && chatMeta.gameActiveState !== state.gameState) {
      useGameModeStore.getState().setGameState(chatMeta.gameActiveState as GameActiveState);
    }
    const metadataMaps = Array.isArray(chatMeta.gameMaps) ? (chatMeta.gameMaps as GameMap[]) : [];
    const activeMapId = typeof chatMeta.activeGameMapId === "string" ? chatMeta.activeGameMapId : null;
    if (metadataMaps.length > 0) {
      useGameModeStore.getState().setMaps(metadataMaps, activeMapId);
    } else if (chatMeta.gameMap && chatMeta.gameMap !== state.currentMap) {
      useGameModeStore.getState().setCurrentMap(chatMeta.gameMap as GameMap);
    } else if (!chatMeta.gameMap) {
      useGameModeStore.getState().setMaps([], null);
    }
    if (Array.isArray(chatMeta.gameNpcs)) {
      useGameModeStore.getState().setNpcs(chatMeta.gameNpcs as any[]);
    }
    if (chatMeta.gameSessionNumber) {
      useGameModeStore.getState().setSessionNumber(chatMeta.gameSessionNumber as number);
    }
    if (chatMeta.gameSessionStatus === "setup") {
      useGameModeStore.getState().setSetupActive(true);
    }

    const bp =
      chatMeta.gameBlueprint && typeof chatMeta.gameBlueprint === "object"
        ? (chatMeta.gameBlueprint as GameBlueprint)
        : null;

    if (bp && (activeGameChanged || activeSessionChanged || !state.blueprint)) {
      useGameModeStore.getState().setBlueprint(bp);
    }

    const persistedWidgets = Array.isArray(chatMeta.gameWidgetState)
      ? normalizeHudWidgets(chatMeta.gameWidgetState as HudWidget[])
      : null;
    const blueprintWidgets = Array.isArray(bp?.hudWidgets) ? normalizeHudWidgets(bp.hudWidgets) : null;
    const nextWidgets =
      persistedWidgets ??
      (activeGameChanged || activeSessionChanged || state.hudWidgets.length === 0 ? blueprintWidgets : null);

    if (nextWidgets) {
      const nextSignature = getHudWidgetStateSignature(nextWidgets);
      const pendingSignature = getPendingHudWidgetPersistenceSignature(activeChatId);
      if (!pendingSignature || pendingSignature === nextSignature) {
        const currentSignature = getHudWidgetStateSignature(useGameModeStore.getState().hudWidgets);
        if (currentSignature !== nextSignature) {
          useGameModeStore.getState().setHudWidgets(nextWidgets);
        }
      }
    }
  }, [activeChatId, chatMeta]);
}

// ── New Game Mechanics Hooks ──

export function useCombatRound() {
  return useMutation({
    mutationFn: (data: {
      chatId: string;
      combatants: Array<Omit<Combatant, "sprite">>;
      round: number;
      playerAction?: CombatPlayerAction;
      partyActions?: Record<string, CombatPlayerAction>;
      controlledId?: string;
      mechanics?: import("@marinara-engine/shared").CombatMechanic[];
    }) => api.post<{ result: CombatRoundResult; combatants: Combatant[] }>("/game/combat/round", data),
  });
}

// ── Tactical (grid) combat ──
// Mirrors useCombatRound's shape: thin mutations over the pure shared engine that
// lives server-side behind these endpoints. State round-trips through the client
// exactly like classic combat (no new DB table); the client persists the returned
// snapshot to chat metadata.

/** Start a fresh tactical battle. Server builds the seeded grid + spawns. */
export function useTacticalCombatStart() {
  return useMutation({
    mutationFn: (data: {
      chatId: string;
      party: Combatant[];
      enemies: Combatant[];
      weather?: CombatWeather | null;
      seed?: number;
      battlefield?: TacticalBattlefieldBrief;
      /** Blueprint scene context — themes the terrain (styleNotes.environmentType). */
      environment?: string;
      /** Blueprint battlefield.formation — drives spawn placement. */
      formation?: string;
    }) =>
      api.post<{
        state: TacticalCombatState;
        /** By initiative, the turns taken before the first one the player commands (combat C6c). */
        opening?: { before: TacticalCombatState; events: TacticalEvent[] };
      }>("/game/combat/tactical/start", data),
  });
}

/** Apply one tactical action; server validates + resolves, running the enemy phase if it flips. */
export function useTacticalCombatAction() {
  return useMutation({
    mutationFn: (data: { chatId: string; state: TacticalCombatState; action: TacticalAction }) =>
      api.post<{ state: TacticalCombatState; events: TacticalEvent[] }>("/game/combat/tactical/action", data),
  });
}

export function useAdvanceTime() {
  const qc = useQueryClient();
  return useMutation({
    // An action's span, or a number of minutes (the overworld's real time, worldgen W8).
    mutationFn: (data: { chatId: string; action: string } | { chatId: string; minutes: number; keepalive?: boolean }) =>
      api.post<{ time: unknown; formatted: string }>(
        "/game/time/advance",
        "minutes" in data ? { chatId: data.chatId, minutes: data.minutes } : data,
        "minutes" in data && data.keepalive ? { keepalive: true } : undefined,
      ),
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      // Sync time into the game state snapshot so WeatherEffects updates immediately
      if (res.formatted) {
        const current = useGameStateStore.getState().current;
        if (current) {
          useGameStateStore.getState().setGameState({
            ...current,
            time: res.formatted,
          });
        }
      }
    },
  });
}

export function useUpdateWeather() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; action: string; location?: string; season?: string; type?: string }) =>
      api.post<{ changed: boolean; weather: { type: string; temperature: number } }>("/game/weather/update", data),
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      // Sync weather into the game state snapshot store so WeatherEffects updates immediately
      if (res.changed && res.weather) {
        const current = useGameStateStore.getState().current;
        if (current) {
          useGameStateStore.getState().setGameState({
            ...current,
            weather: res.weather.type,
            temperature: `${res.weather.temperature}°C`,
          });
        }
      }
    },
  });
}

export function useUpdateReputation() {
  const qc = useQueryClient();
  const store = useGameModeStore;
  return useMutation({
    mutationFn: (data: { chatId: string; actions: Array<{ npcId: string; action: string; modifier?: number }> }) =>
      api.post<{ npcs: unknown[]; changes: unknown[] }>("/game/reputation/update", data),
    onSuccess: (res, variables) => {
      store.getState().setNpcs(res.npcs as any[]);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: [...gameKeys.all, "journal", variables.chatId] });
    },
  });
}

// ── The overworld (worldgen W8) ──

/** Where the party is on the overworld, the walk its next turn tells, and the places in ruins. */
export interface OverworldState {
  here: string | null;
  walk: WorldWalk | null;
  ruined: string[];
  /** Sites the story keeps closed until the Game Master opens them, shown sealed (older servers: none). */
  locked?: Record<string, "sealed">;
  /** Sites the story keeps off the overworld until revealed. */
  hidden?: string[];
}

/** The world as the party knows it (the Journal's World tab), read again after each turn (`turnKey`), so
 *  a swipe or branch never shows another turn's world. */
export function useWorldJournal(chatId: string, turnKey: string | null) {
  return useQuery({
    queryKey: [...gameKeys.worldJournal(chatId), turnKey],
    queryFn: () => api.get<{ journal: WorldJournal | null }>(`/game/${chatId}/world-journal`),
    select: (data) => data.journal,
    enabled: !!chatId,
  });
}

/** The overworld of a game with a world, read again after each turn (`turnKey`). */
/** The game's world (worldgen W8, W11) as the server keeps it, never made again here from its recipe.
 *  `recipe` names the stored recipe, so a world whose edits were saved is read again. */
export function useGameWorld(chatId: string, recipe: string | null) {
  return useQuery({
    queryKey: [...gameKeys.world(chatId), recipe],
    queryFn: () => api.get<{ world: GameWorld | null }>(`/game/${chatId}/world`),
    select: (data) => data.world,
    enabled: recipe !== null && !!chatId,
    staleTime: Infinity,
    // The same game's world stays on screen while its edits are read again, never another game's.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === chatId ? previous : undefined),
  });
}

export function useOverworld(chatId: string, turnKey: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...gameKeys.overworld(chatId), turnKey],
    queryFn: () => api.get<{ overworld: OverworldState | null }>(`/game/${chatId}/overworld`),
    select: (data) => data.overworld,
    enabled: enabled && !!chatId,
    staleTime: 30_000,
  });
}

/** A walk to a settlement: the server reads the route and passes its days on the game's clock. */
export function useOverworldWalk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; to: string }) =>
      api.post<{ walk: WorldWalk; route: WorldRoute; formatted: string }>(`/game/${data.chatId}/overworld/walk`, {
        to: data.to,
      }),
    // The party is where it walked at once, so the overworld never shows it back where it set out.
    onSuccess: (res, variables) => {
      qc.setQueriesData<{ overworld: OverworldState | null }>(
        { queryKey: gameKeys.overworld(variables.chatId) },
        (old) => (old?.overworld ? { overworld: { ...old.overworld, here: res.walk.to, walk: res.walk } } : old),
      );
    },
    onSettled: (_res, _error, variables) => {
      qc.invalidateQueries({ queryKey: gameKeys.overworld(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

// ── The town (worldgen W8b) ──

/** The town the party is in, where in it the party stands, and the visit its next turn tells. */
export type TownState = WorldTown & { at: string; visit: WorldTownVisit | null };

export function useTown(chatId: string, turnKey: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...gameKeys.town(chatId), turnKey],
    queryFn: () => api.get<{ town: TownState | null }>(`/game/${chatId}/town`),
    select: (data) => data.town,
    enabled: enabled && !!chatId,
    staleTime: 30_000,
  });
}

/** The rooms of a building in the town the party is in (worldgen W13). */
export function useTownInterior(chatId: string, buildingId: string | null) {
  return useQuery({
    queryKey: [...gameKeys.town(chatId), "interior", buildingId],
    queryFn: () =>
      api.get<{ interior: WorldInterior }>(`/game/${chatId}/town/interior?building=${encodeURIComponent(buildingId!)}`),
    select: (data) => data.interior,
    enabled: !!chatId && !!buildingId,
    staleTime: 5 * 60_000,
  });
}

/** A walk across town to a building or the square: its minutes go on the game's clock. */
export function useTownVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; to: string }) =>
      api.post<{
        visit: WorldTownVisit;
        at: string;
        /** The way walked, as the cells after the door the party left (older servers: none). */
        path?: Array<{ x: number; y: number }>;
        minutes: number;
        formatted: string;
      }>(`/game/${data.chatId}/town/visit`, { to: data.to }),
    // The party is where it walked at once, so the town never shows it back where it set out.
    onSuccess: (res, variables) => {
      qc.setQueriesData<{ town: TownState | null }>({ queryKey: gameKeys.town(variables.chatId) }, (old) =>
        old?.town ? { town: { ...old.town, at: res.at, visit: res.visit } } : old,
      );
    },
    onSettled: (_res, _error, variables) => {
      qc.invalidateQueries({ queryKey: gameKeys.town(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

// ── Dungeon, cave and station maps ──

/** The map the party is on, and the walk on it its next turn tells. */
export function useDungeonMap(chatId: string, turnKey: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...gameKeys.dungeonMap(chatId), turnKey],
    queryFn: () => api.get<{ map: GameDungeonMap | null; walk: GameDungeonWalk | null }>(`/game/${chatId}/map`),
    enabled: enabled && !!chatId,
    staleTime: 30_000,
  });
}

/** A walk on the map to a cell, by the shortest way: its minutes go on the game's clock. */
export function useDungeonWalk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; map: string; x: number; y: number }) =>
      api.post<{
        map: GameDungeonMap;
        walk: GameDungeonWalk;
        path: Array<{ x: number; y: number }>;
        minutes: number;
        formatted: string;
      }>(`/game/${data.chatId}/map/walk`, { map: data.map, x: data.x, y: data.y }),
    // The party is where it walked at once, so the map never shows it back where it set out.
    onSuccess: (res, variables) => {
      qc.setQueriesData<{ map: GameDungeonMap | null; walk: GameDungeonWalk | null }>(
        { queryKey: gameKeys.dungeonMap(variables.chatId) },
        (old) => (old ? { map: res.map, walk: res.walk } : old),
      );
    },
    onSettled: (_res, _error, variables) => {
      qc.invalidateQueries({ queryKey: gameKeys.dungeonMap(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

/** The party leaves the map by the way out it stands on. */
export function useDungeonLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; map: string }) =>
      api.post<{ left: string }>(`/game/${data.chatId}/map/leave`, { map: data.map }),
    onSettled: (_res, _error, variables) => {
      qc.invalidateQueries({ queryKey: gameKeys.dungeonMap(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

/** Going down into a place in town the party stands at (a cave, a mine, a crypt, by its words), or into a
 *  site out in the world the party is at on the overworld. */
export function useDungeonEnter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; at?: string; place?: string }) =>
      api.post<{ map: GameDungeonMap }>(
        `/game/${data.chatId}/map/enter`,
        data.place ? { place: data.place } : { at: data.at },
      ),
    onSettled: (_res, _error, variables) => {
      qc.invalidateQueries({ queryKey: gameKeys.dungeonMap(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}
