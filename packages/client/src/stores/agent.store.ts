// ──────────────────────────────────────────────
// Zustand Store: Agent Slice
// ──────────────────────────────────────────────
import { create } from "zustand";
import type {
  AgentCallDebugEvent,
  AgentResult,
  AgentWriteApprovalProposal,
  CharacterCardFieldUpdate,
} from "@marinara-engine/shared";
import type { AgentFailure } from "../lib/agent-failures";

/**
 * A character_card_update result awaiting user confirmation.
 *
 * Character cards are sensitive (they define the character's identity) so
 * the Card Evolution Auditor never writes them automatically — each batch
 * of proposed edits sits here until the user approves or rejects it.
 */
export interface PendingCardUpdate {
  /** Client-generated ID, used as key for dismissal. */
  id: string;
  chatId: string;
  agentType: string;
  characterId: string;
  characterName: string;
  updates: CharacterCardFieldUpdate[];
  agentName: string;
  /** ms since epoch — used for stable ordering. */
  timestamp: number;
}

export interface PendingAgentWriteApproval extends AgentWriteApprovalProposal {
  /** Client-generated ID, used as key for dismissal. */
  id: string;
  /** ms since epoch — used for stable ordering. */
  timestamp: number;
}

export interface AgentDebugEntry {
  phase: string;
  agents?: Array<{
    type: string;
    name: string;
    model: string;
    maxTokens: number;
  }>;
  results?: AgentResult[];
  toolCall?: {
    name: string;
    arguments: string;
    allowed: boolean;
  };
  toolResult?: {
    name: string;
    result: string;
    success: boolean;
  };
  agentCall?: AgentCallDebugEvent;
  batchMaxTokens?: number;
  timestamp: number;
}

function logAgentDebugToBrowserConsole(entry: AgentDebugEntry) {
  const call = entry.agentCall;
  if (!call) {
    console.debug("[Marinara Agent Debug]", entry);
    return;
  }

  const usageParts = [
    call.promptTokens != null ? `prompt ${call.promptTokens}` : null,
    call.completionTokens != null ? `completion ${call.completionTokens}` : null,
    call.reasoningTokens != null ? `reasoning ${call.reasoningTokens}` : null,
    call.totalTokens != null ? `total ${call.totalTokens}` : null,
  ].filter(Boolean);
  const round = call.round != null ? ` round ${call.round}` : "";
  const usage = usageParts.length > 0 ? ` | ${usageParts.join(", ")} tokens` : "";
  const duration = call.durationMs != null ? ` | ${call.durationMs}ms` : "";
  const label = `[Marinara Agent Debug] ${call.stage}${round}: ${call.agentName} (${call.agentType}) | ${call.model}${usage}${duration}`;

  console.groupCollapsed(label);
  console.debug("Event", call);
  if (call.messages?.length) console.debug("Messages", call.messages);
  if (call.response) console.debug("Response", call.response);
  if (call.batchedAgentTypes?.length) console.debug("Batched agents", call.batchedAgentTypes);
  if (call.tools?.length) console.debug("Tools", call.tools);
  console.groupEnd();
}

interface AgentState {
  activeAgents: string[];
  lastResults: Map<string, AgentResult>;
  debugLog: AgentDebugEntry[];
  isProcessing: boolean;
  /** Chat IDs with agent work currently in flight. Keeps active-chat UI from flashing for background runs. */
  processingChatIds: string[];
  /** Agent types that failed even after auto-retry — manual retry available */
  failedAgentTypes: string[];
  /** Chat ID the failed-agent list belongs to. Null means legacy/global failures. */
  failedAgentChatId: string | null;
  /** Rich failure details for the retry UI and troubleshooting copy */
  failedAgentFailures: AgentFailure[];
  thoughtBubbles: Array<{
    agentId: string;
    agentName: string;
    content: string;
    timestamp: number;
  }>;
  echoMessages: Array<{
    characterName: string;
    reaction: string;
    timestamp: number;
  }>;
  /** How many echo messages are currently revealed (stagger counter) */
  echoVisibleCount: number;
  /** Baseline: messages at or below this count are shown without stagger */
  echoBaseline: number;
  /** Chat ID whose echo messages have been loaded — prevents redundant fetches across remounts */
  echoLoadedChatId: string | null;
  cyoaChoices: Array<{
    label: string;
    text: string;
  }>;
  cyoaChoicesChatId: string | null;
  /** Latest Music DJ YouTube "play" intent. nonce bumps each pick so the player reacts. */
  youtubePlay: { searchQuery: string; mood: string; nonce: number } | null;
  /** Latest Music DJ YouTube volume directive (0-100), independent of track changes. */
  youtubeVolume: number | null;
  /** Latest Music DJ Custom "play" intent. nonce bumps each pick so the player reacts. */
  localMusicPlay: { path: string; title: string; mood: string; nonce: number } | null;
  /** Latest Music DJ Custom volume directive (0-100), independent of track changes. */
  localMusicVolume: number | null;
  pendingCardUpdates: PendingCardUpdate[];
  pendingAgentWriteApprovals: PendingAgentWriteApproval[];

  // Actions
  setActiveAgents: (agents: string[]) => void;
  setProcessing: (processing: boolean, chatId?: string | null) => void;
  addResult: (agentId: string, result: AgentResult) => void;
  addDebugEntry: (entry: Omit<AgentDebugEntry, "timestamp"> & { timestamp?: number }) => void;
  clearDebugLog: () => void;
  setFailedAgentTypes: (types: string[], chatId?: string | null) => void;
  setFailedAgentFailures: (failures: AgentFailure[], chatId?: string | null) => void;
  clearFailedAgentTypes: (chatId?: string | null) => void;
  addThoughtBubble: (agentId: string, agentName: string, content: string) => void;
  dismissThoughtBubble: (index: number) => void;
  clearThoughtBubbles: () => void;
  addEchoMessage: (characterName: string, reaction: string) => void;
  setEchoMessages: (messages: Array<{ characterName: string; reaction: string; timestamp: number }>) => void;
  clearEchoMessages: () => void;
  setEchoVisibleCount: (count: number) => void;
  setEchoBaseline: (count: number) => void;
  setEchoLoadedChatId: (chatId: string | null) => void;
  setCyoaChoices: (choices: Array<{ label: string; text: string }>, chatId?: string | null) => void;
  clearCyoaChoices: () => void;
  setYoutubePlay: (play: { searchQuery: string; mood: string }) => void;
  setYoutubeVolume: (volume: number | null) => void;
  clearYoutube: () => void;
  setLocalMusicPlay: (play: { path: string; title: string; mood: string }) => void;
  setLocalMusicVolume: (volume: number | null) => void;
  clearLocalMusic: () => void;
  enqueuePendingCardUpdate: (entry: PendingCardUpdate) => void;
  dismissPendingCardUpdate: (id: string) => void;
  clearPendingCardUpdates: () => void;
  enqueuePendingAgentWriteApproval: (entry: PendingAgentWriteApproval) => void;
  dismissPendingAgentWriteApproval: (id: string) => void;
  clearPendingAgentWriteApprovals: () => void;
  reset: () => void;
}

type AgentDataState = Pick<
  AgentState,
  | "activeAgents"
  | "lastResults"
  | "debugLog"
  | "isProcessing"
  | "processingChatIds"
  | "failedAgentTypes"
  | "failedAgentChatId"
  | "failedAgentFailures"
  | "thoughtBubbles"
  | "echoMessages"
  | "echoVisibleCount"
  | "echoBaseline"
  | "echoLoadedChatId"
  | "cyoaChoices"
  | "cyoaChoicesChatId"
  | "youtubePlay"
  | "youtubeVolume"
  | "localMusicPlay"
  | "localMusicVolume"
  | "pendingCardUpdates"
  | "pendingAgentWriteApprovals"
>;

function createInitialAgentDataState(): AgentDataState {
  return {
    activeAgents: [],
    lastResults: new Map(),
    debugLog: [],
    isProcessing: false,
    processingChatIds: [],
    failedAgentTypes: [],
    failedAgentChatId: null,
    failedAgentFailures: [],
    thoughtBubbles: [],
    echoMessages: [],
    echoVisibleCount: 0,
    echoBaseline: 0,
    echoLoadedChatId: null,
    cyoaChoices: [],
    cyoaChoicesChatId: null,
    youtubePlay: null,
    youtubeVolume: null,
    localMusicPlay: null,
    localMusicVolume: null,
    pendingCardUpdates: [],
    pendingAgentWriteApprovals: [],
  };
}

export const useAgentStore = create<AgentState>((set) => ({
  ...createInitialAgentDataState(),

  setActiveAgents: (agents) => set({ activeAgents: agents }),
  setProcessing: (processing, chatId = null) =>
    set((s) => {
      if (!chatId) {
        return {
          isProcessing: processing,
          processingChatIds: processing ? s.processingChatIds : [],
        };
      }

      const processingChatIds = processing
        ? s.processingChatIds.includes(chatId)
          ? s.processingChatIds
          : [...s.processingChatIds, chatId]
        : s.processingChatIds.filter((id) => id !== chatId);

      return {
        processingChatIds,
        isProcessing: processingChatIds.length > 0,
      };
    }),

  addResult: (agentId, result) =>
    set((s) => {
      const results = new Map(s.lastResults);
      results.set(agentId, result);
      // Cap at 50 entries — evict oldest
      if (results.size > 50) {
        const first = results.keys().next().value;
        if (first !== undefined) results.delete(first);
      }
      return { lastResults: results };
    }),

  addDebugEntry: (entry) => {
    const stamped = { ...entry, timestamp: entry.timestamp ?? Date.now() };
    logAgentDebugToBrowserConsole(stamped);
    set((s) => ({
      debugLog: [...s.debugLog, stamped].slice(-100),
    }));
  },

  clearDebugLog: () => set({ debugLog: [] }),

  setFailedAgentTypes: (types, chatId = null) =>
    set({
      failedAgentTypes: types,
      failedAgentChatId: chatId,
      failedAgentFailures: types.map((agentType) => ({
        agentType,
        agentName: agentType,
        error: null,
        reasonLabel: null,
      })),
    }),
  setFailedAgentFailures: (failures, chatId = null) =>
    set({
      failedAgentTypes: failures.map((failure) => failure.agentType),
      failedAgentChatId: chatId,
      failedAgentFailures: failures,
    }),
  clearFailedAgentTypes: (chatId = null) =>
    set((s) => {
      if (chatId && s.failedAgentChatId && s.failedAgentChatId !== chatId) return {};
      return { failedAgentTypes: [], failedAgentChatId: null, failedAgentFailures: [] };
    }),

  addThoughtBubble: (agentId, agentName, content) =>
    set((s) => ({
      thoughtBubbles: [...s.thoughtBubbles, { agentId, agentName, content, timestamp: Date.now() }].slice(-50),
    })),

  dismissThoughtBubble: (index) =>
    set((s) => ({
      thoughtBubbles: s.thoughtBubbles.filter((_, i) => i !== index),
    })),

  clearThoughtBubbles: () => set({ thoughtBubbles: [] }),

  addEchoMessage: (characterName, reaction) =>
    set((s) => ({
      echoMessages: [...s.echoMessages, { characterName, reaction, timestamp: Date.now() }].slice(-500),
    })),

  setEchoMessages: (messages) => set({ echoMessages: messages.slice(-500) }),

  clearEchoMessages: () => set({ echoMessages: [], echoVisibleCount: 0, echoBaseline: 0, echoLoadedChatId: null }),

  setEchoVisibleCount: (count) => set({ echoVisibleCount: count }),
  setEchoBaseline: (count) => set({ echoBaseline: count }),
  setEchoLoadedChatId: (chatId) => set({ echoLoadedChatId: chatId }),

  setCyoaChoices: (choices, chatId = null) => set({ cyoaChoices: choices, cyoaChoicesChatId: chatId }),
  clearCyoaChoices: () => set({ cyoaChoices: [], cyoaChoicesChatId: null }),

  setYoutubePlay: ({ searchQuery, mood }) =>
    set((s) => ({ youtubePlay: { searchQuery, mood, nonce: (s.youtubePlay?.nonce ?? 0) + 1 } })),
  setYoutubeVolume: (volume) => set({ youtubeVolume: volume }),
  clearYoutube: () => set({ youtubePlay: null, youtubeVolume: null }),
  setLocalMusicPlay: ({ path, title, mood }) =>
    set((s) => ({ localMusicPlay: { path, title, mood, nonce: (s.localMusicPlay?.nonce ?? 0) + 1 } })),
  setLocalMusicVolume: (volume) => set({ localMusicVolume: volume }),
  clearLocalMusic: () => set({ localMusicPlay: null, localMusicVolume: null }),

  enqueuePendingCardUpdate: (entry) =>
    set((s) => ({ pendingCardUpdates: [...s.pendingCardUpdates, entry].slice(-20) })),
  dismissPendingCardUpdate: (id) =>
    set((s) => ({ pendingCardUpdates: s.pendingCardUpdates.filter((e) => e.id !== id) })),
  clearPendingCardUpdates: () => set({ pendingCardUpdates: [] }),
  enqueuePendingAgentWriteApproval: (entry) =>
    set((s) => ({ pendingAgentWriteApprovals: [...s.pendingAgentWriteApprovals, entry].slice(-20) })),
  dismissPendingAgentWriteApproval: (id) =>
    set((s) => ({
      pendingAgentWriteApprovals: s.pendingAgentWriteApprovals.filter((entry) => entry.id !== id),
    })),
  clearPendingAgentWriteApprovals: () => set({ pendingAgentWriteApprovals: [] }),

  reset: () => set(createInitialAgentDataState()),
}));
