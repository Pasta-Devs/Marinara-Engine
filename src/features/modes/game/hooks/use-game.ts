// ──────────────────────────────────────────────
// Hook: Game Mode API
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isJsonRepairApiError } from "../../../../shared/api/api-errors";
import { chatKeys } from "../../../catalog/chats/index";
import { lorebookKeys } from "../../../catalog/lorebooks/index";
import {
  getHudWidgetStateSignature,
  getPendingHudWidgetPersistenceSignature,
  useGameModeStore,
} from "../stores/game-mode.store";
import { useGameStateStore } from "../../../runtime/world-state/index";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { gameApi } from "../api/game-api";
import type { CombatMechanic } from "../../../../engine/contracts/types/combat-encounter";
import type {
  GameActiveState,
  GameMap,
  GameSetupConfig,
  Combatant,
  CombatPlayerAction,
  GameNpc,
  HudWidget,
  GameBlueprint,
} from "../../../../engine/contracts/types/game";
import type { Chat } from "../../../../engine/contracts/types/chat";

// ── Query Keys ──

export const gameKeys = {
  all: ["game"] as const,
  sessions: (gameId: string) => [...gameKeys.all, "sessions", gameId] as const,
};

export function patchChatMetadata(chat: Chat | null | undefined, patch: Record<string, unknown>): Chat | null {
  if (!chat) return null;
  const rawMetadata = chat.metadata as unknown;
  const metadata =
    typeof rawMetadata === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(rawMetadata);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : {};
          } catch {
            return {};
          }
        })()
      : rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
        ? (rawMetadata as Record<string, unknown>)
        : {};
  return {
    ...chat,
    metadata: {
      ...metadata,
      ...patch,
    } as Chat["metadata"],
  };
}

function publishSessionChat(qc: QueryClient, sessionChat: Chat | null | undefined): string | null {
  if (!sessionChat?.id) return null;
  qc.setQueryData(chatKeys.detail(sessionChat.id), sessionChat);
  if (useChatStore.getState().activeChatId === sessionChat.id) {
    useChatStore.getState().setActiveChat(sessionChat);
  }
  return sessionChat.id;
}

// ── Mutations ──

export function useCreateGame() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: {
      name: string;
      setupConfig: GameSetupConfig;
      connectionId?: string;
      characterConnectionId?: string;
      promptPresetId?: string;
      chatId?: string;
      partyCharacterIds?: string[];
    }) => gameApi.createGame(data),
    onSuccess: (res) => {
      store.getState().setActiveGame(res.gameId, res.sessionChat.id, null);
      store.getState().setSetupActive(true);
      publishSessionChat(qc, res.sessionChat);
      // Collapse sidebar when starting a new game to maximize game area
      useUIStore.getState().setSidebarOpen(false);
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
    onError: (err) => {
      console.error("[createGame] Error:", err);
    },
  });
}

export function useGameSetup() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string; connectionId?: string; preferences: string; setupConfig?: GameSetupConfig }) =>
      gameApi.setupGame(data),
    onSuccess: (res) => {
      store.getState().setSetupActive(false);
      const sessionChatId = publishSessionChat(qc, res.sessionChat) || store.getState().activeSessionChatId;
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
    mutationFn: (data: { chatId: string }) => gameApi.startGame(data),
    onSuccess: (res) => {
      const sessionChatId = publishSessionChat(qc, res.sessionChat) || store.getState().activeSessionChatId;
      if (sessionChatId) {
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
    mutationFn: (data: { gameId: string; connectionId?: string }) => gameApi.startSession(data),
    onMutate: (variables) => {
      toast.loading("Starting the next session and generating recap...", {
        id: `game-session-start:${variables.gameId}`,
      });
    },
    onSuccess: (res, variables) => {
      store.getState().setActiveGame(variables.gameId, res.sessionChat.id, null);
      store.getState().setSessionNumber(res.sessionNumber);
      publishSessionChat(qc, res.sessionChat);
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
      gameApi.concludeSession(data),
    onMutate: (variables) => {
      console.info("[game/session/conclude] Starting conclude request", variables);
      toast.loading("Ending session and generating summary...", {
        id: `game-session-conclude:${variables.chatId}`,
      });
    },
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
      console.info("[game/session/conclude] Conclude request completed", variables);
      toast.success("Session concluded.", {
        id: `game-session-conclude:${variables.chatId}`,
      });
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
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
      gameApi.concludeSession(data),
    onMutate: (variables) => {
      toast.loading(`Regenerating session ${variables.sessionNumber} conclusion...`, {
        id: `game-session-regenerate:${variables.chatId}:${variables.sessionNumber}`,
      });
    },
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
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
      gameApi.regenerateSessionLorebook(data),
    onMutate: (variables) => {
      toast.loading(`Regenerating session ${variables.sessionNumber} lorebook...`, {
        id: `game-session-lorebook:${variables.chatId}:${variables.sessionNumber}`,
      });
    },
    onSuccess: (result, variables) => {
      publishSessionChat(qc, result.sessionChat);
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
          duration: 8000,
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
      gameApi.updateCampaignProgression(data),
    onMutate: (variables) => {
      toast.loading(`Updating plot arcs from session ${variables.sessionNumber}...`, {
        id: `game-campaign-progression:${variables.chatId}:${variables.sessionNumber}`,
      });
    },
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
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
    mutationFn: (data: { chatId: string; characterName: string; connectionId?: string }) =>
      gameApi.upsertPartyCard({ ...data, added: true }),
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
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

export function useRemovePartyMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chatId: string; characterName: string }) => gameApi.removePartyMember(data),
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
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
    mutationFn: (data: { chatId: string; notation: string; context?: string }) => gameApi.rollDice(data),
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
      dc: number;
      advantage?: boolean;
      disadvantage?: boolean;
      preRolledD20?: number;
      messageId?: string;
    }) => gameApi.skillCheck(data),
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
    mutationFn: (data: { chatId: string; newState: GameActiveState }) => gameApi.transitionGameState(data),
    onSuccess: (res, variables) => {
      store.getState().setGameState(res.newState);
      publishSessionChat(qc, res.sessionChat);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

export function useGenerateMap() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string; locationType: string; context: string; connectionId?: string }) =>
      gameApi.generateMap(data),
    onSuccess: (res, variables) => {
      if (store.getState().activeSessionChatId === variables.chatId) {
        if (res.maps?.length) {
          store.getState().setMaps(res.maps, res.activeGameMapId);
        } else {
          store.getState().setCurrentMap(res.map);
        }
      }
      publishSessionChat(qc, res.sessionChat);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
  });
}

export function useMoveOnMap() {
  const qc = useQueryClient();
  const store = useGameModeStore;

  return useMutation({
    mutationFn: (data: { chatId: string; position: { x: number; y: number } | string; mapId?: string | null }) =>
      gameApi.moveOnMap(data),
    onSuccess: (res, variables) => {
      if (res.maps?.length) {
        store.getState().setMaps(res.maps, res.activeGameMapId);
      } else {
        store.getState().setCurrentMap(res.map);
      }
      publishSessionChat(qc, res.sessionChat);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: [...gameKeys.all, "journal", variables.chatId] });
    },
  });
}

export function useUpdateGameWidgets() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, widgets }: { chatId: string; widgets: HudWidget[] }) =>
      gameApi.updateWidgets({ chatId, widgets }),
    onSuccess: (res, variables) => {
      useGameModeStore.getState().setHudWidgets(variables.widgets);
      publishSessionChat(qc, res.sessionChat);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
    onError: (err) => {
      console.error("[updateGameWidgets] Error:", err);
    },
  });
}

// ── Queries ──

// ── Sync hook — reads chat metadata and updates game store ──

function isNumericHudWidgetType(type: HudWidget["type"]) {
  return type === "progress_bar" || type === "gauge" || type === "relationship_meter";
}

function finiteNumber(value: unknown): number | null {
  const raw = typeof value === "string" && value.trim() ? Number(value.trim()) : value;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

type LegacyInventoryGridItem = { name: string; slot?: string; quantity?: number };

function positiveInventoryQuantity(value: unknown): number {
  const quantity = finiteNumber(value) ?? 1;
  return Math.max(1, Math.floor(quantity));
}

function legacyInventoryGridItems(value: unknown): LegacyInventoryGridItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: LegacyInventoryGridItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    if (!name) continue;
    const slot = typeof record.slot === "string" ? record.slot : undefined;
    items.push({
      name,
      ...(slot ? { slot } : {}),
      quantity: positiveInventoryQuantity(record.quantity),
    });
  }
  return items;
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

    const legacyItems = legacyInventoryGridItems((w.config as HudWidget["config"] & { items?: unknown }).items);
    if (w.type === "inventory_grid" && !w.config.contents && legacyItems) {
      return {
        ...w,
        config: {
          ...w.config,
          contents: legacyItems,
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
    }
    if (Array.isArray(chatMeta.gameNpcs)) {
      useGameModeStore.getState().setNpcs(chatMeta.gameNpcs as GameNpc[]);
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
      mechanics?: CombatMechanic[];
    }) => gameApi.combatRound(data),
  });
}

export function useAdvanceTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; action: string }) => gameApi.advanceTime(data),
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
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
      gameApi.updateWeather(data),
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
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

export function useRollEncounter() {
  return useMutation({
    mutationFn: (data: { chatId: string; action: string; location?: string }) => gameApi.rollEncounter(data),
  });
}

export function useUpdateReputation() {
  const qc = useQueryClient();
  const store = useGameModeStore;
  return useMutation({
    mutationFn: (data: { chatId: string; actions: Array<{ npcId: string; action: string; modifier?: number }> }) =>
      gameApi.updateReputation(data),
    onSuccess: (res, variables) => {
      store.getState().setNpcs(res.npcs);
      publishSessionChat(qc, res.sessionChat);
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: [...gameKeys.all, "journal", variables.chatId] });
    },
  });
}

export function useJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; type: string; data: Record<string, unknown> }) =>
      gameApi.addJournalEntry(data),
    onSuccess: (res, variables) => {
      publishSessionChat(qc, res.sessionChat);
      qc.invalidateQueries({ queryKey: [...gameKeys.all, "journal", variables.chatId] });
    },
  });
}

// ── Checkpoints ──

export function useGameCheckpoints(chatId: string | null) {
  return useQuery({
    queryKey: [...gameKeys.all, "checkpoints", chatId],
    queryFn: () => gameApi.listCheckpoints(chatId!),
    enabled: !!chatId,
    staleTime: 30_000,
  });
}

export function useCreateCheckpoint() {
  return useMutation({
    mutationFn: (data: { chatId: string; label: string; triggerType: string }) => gameApi.createCheckpoint(data),
  });
}

export function useLoadCheckpoint() {
  return useMutation({
    mutationFn: (data: { chatId: string; checkpointId: string }) => gameApi.loadCheckpoint(data),
  });
}

export function useBranchCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; checkpointId: string }) => gameApi.branchFromCheckpoint(data),
    onSuccess: (newChat, { chatId }) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      qc.invalidateQueries({ queryKey: [...gameKeys.all, "checkpoints", chatId] });
      if (newChat?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(newChat.groupId) });
      }
      if (newChat?.id) {
        qc.setQueryData(chatKeys.detail(newChat.id), newChat);
      }
    },
  });
}

export function useDeleteCheckpoint() {
  return useMutation({
    mutationFn: (id: string) => gameApi.deleteCheckpoint(id),
  });
}
