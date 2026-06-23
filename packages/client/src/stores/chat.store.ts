// ──────────────────────────────────────────────
// Zustand Store: Chat Slice
// ──────────────────────────────────────────────
import { create } from "zustand";
import type { AvatarCropValue } from "../lib/utils";
import { subscribeWithSelector } from "zustand/middleware";
import type { Chat, ChatMode, ConversationPresenceStatus, Message } from "@marinara-engine/shared";
import { useAgentStore } from "./agent.store";
import { useGameStateStore } from "./game-state.store";

const STORAGE_KEY = "marinara-active-chat-id";
const DRAFTS_KEY = "marinara-input-drafts";
const NOTIFICATION_AUTODISMISS_MS = 8000;

type NotificationAvatarCrop = AvatarCropValue | null;

type DelayedCharacterStatus = ConversationPresenceStatus;

export type DelayedCharacterInfo = {
  name: string;
  status: DelayedCharacterStatus;
  characterIds?: string[];
  characterNames?: string[];
  characterStatuses?: Record<string, DelayedCharacterStatus>;
};

/** Read drafts from localStorage so typed input survives reloads, tab closes, and app restarts. */
function loadDrafts(): Map<string, string> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) return new Map(JSON.parse(raw));
    const legacyRaw = sessionStorage.getItem(DRAFTS_KEY);
    if (legacyRaw) {
      localStorage.setItem(DRAFTS_KEY, legacyRaw);
      sessionStorage.removeItem(DRAFTS_KEY);
      return new Map(JSON.parse(legacyRaw));
    }
  } catch {
    /* ignore */
  }
  return new Map();
}

/** Write drafts to localStorage. */
function saveDrafts(m: Map<string, string>) {
  try {
    if (m.size === 0) localStorage.removeItem(DRAFTS_KEY);
    else localStorage.setItem(DRAFTS_KEY, JSON.stringify([...m]));
    sessionStorage.removeItem(DRAFTS_KEY);
  } catch {
    /* ignore */
  }
}

function abortGenerationForChat(chatId: string, controller?: AbortController) {
  controller?.abort();
  fetch("/api/generate/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId }),
  }).catch(() => {});
}

const notificationAutoDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearNotificationTimer(chatId: string) {
  const timer = notificationAutoDismissTimers.get(chatId);
  if (!timer) return;
  clearTimeout(timer);
  notificationAutoDismissTimers.delete(chatId);
}

function clearAllNotificationTimers() {
  for (const timer of notificationAutoDismissTimers.values()) {
    clearTimeout(timer);
  }
  notificationAutoDismissTimers.clear();
}

function scheduleNotificationAutoDismiss(chatId: string, getState: () => ChatState) {
  clearNotificationTimer(chatId);
  notificationAutoDismissTimers.set(
    chatId,
    setTimeout(() => {
      clearNotificationTimer(chatId);
      getState().autoDismissNotification(chatId);
    }, NOTIFICATION_AUTODISMISS_MS),
  );
}

interface ChatState {
  activeChatId: string | null;
  activeChat: Chat | null;
  messages: Message[];
  isStreaming: boolean;
  /** The chatId that the current streaming generation belongs to. */
  streamingChatId: string | null;
  /**
   * Per-chat Mari work phase, used to restore the work-status pill when the
   * user switches chats mid-stream. The CustomEvent transport handles the
   * live transitions inside the active chat; this map is the source of truth
   * so the indicator can read the current phase on chat switch.
   *
   * - "thinking" — Mari's reply is streaming (set on first token).
   * - "updating" — Mari's embedded commands are executing (set on
   *   assistant_commands_start).
   * - absent — no Mari work in progress for that chat.
   */
  mariPhaseByChatId: Map<string, "thinking" | "updating">;
  streamBuffer: string;
  /** Per-chat stream text for active generations, so switching chats does not lose in-flight UI state. */
  streamBuffers: Map<string, string>;
  /** Chat IDs whose live stream has been replaced by the saved message while agents continue. */
  committedStreamChatIds: Set<string>;
  thinkingBuffer: string;
  /** Per-chat live thinking text for active generations. */
  thinkingBuffers: Map<string, string>;
  /** Per-chat AbortControllers for active generations — keyed by chatId. */
  abortControllers: Map<string, AbortController>;
  /** When regenerating, the ID of the message being regenerated (so streaming shows in-place). */
  regenerateMessageId: string | null;
  /** During group chat individual mode, the character currently streaming. */
  streamingCharacterId: string | null;
  /** Smart response queues keyed by chatId. */
  responseQueues: Map<string, string[]>;
  /** Character name(s) shown in typing indicator when generation is active. */
  typingCharacterName: string | null;
  /** Human-readable label for the current server-side generation phase (e.g. "Running agents..."). */
  generationPhase: string | null;
  /** Character name + status shown during DND/idle delay (before generation starts). */
  delayedCharacterInfo: DelayedCharacterInfo | null;
  /** Per-chat typing state so switching chats restores the correct indicator. */
  perChatTyping: Map<string, string>;
  /** Per-chat delayed state so switching chats restores the correct indicator. */
  perChatDelayed: Map<string, DelayedCharacterInfo>;
  swipeIndex: Map<string, number>; // messageId → active swipe index
  /** When true, ChatArea should open the settings drawer on next render. */
  shouldOpenSettings: boolean;
  /** When true, ChatArea should show the setup wizard for the newly created chat. */
  shouldOpenWizard: boolean;
  /** When true (and the wizard opens), it should land directly on the Quick Setup shortcut view. */
  shouldOpenWizardInShortcutMode: boolean;
  /** Pending new-chat mode for first-run connection setup gating. */
  pendingNewChatMode: Exclude<ChatMode, "visual_novel"> | null;
  /** Per-chat draft input text so typing isn't lost when navigating away. */
  inputDrafts: Map<string, string>;
  /** Current chat input */
  currentInput: string;
  /** Per-chat unread message count (from autonomous messages). */
  unreadCounts: Map<string, number>;
  /** Floating notification bubbles — tracks character info for each unread chat. */
  chatNotifications: Map<
    string,
    {
      chatId: string;
      characterName: string;
      avatarUrl: string | null;
      avatarCrop?: NotificationAvatarCrop;
      count: number;
    }
  >;
  /** Manually dismissed notification chatIds (won't re-appear until next message). */
  dismissedNotifications: Set<string>;
  /** Pending /goto request — ChatArea fulfils by paginating + scrolling to the target message. Token forces re-fire on identical N. */
  gotoRequest: { chatId: string; messageNumber: number; token: number } | null;

  // Actions
  setActiveChat: (chat: Chat | null) => void;
  setActiveChatId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setStreaming: (streaming: boolean, chatId?: string) => void;
  setStreamCommitted: (chatId: string, committed: boolean) => void;
  setMariPhase: (chatId: string, phase: "thinking" | "updating" | "idle") => void;
  setAbortController: (chatId: string, controller: AbortController | null) => void;
  stopGeneration: (chatId?: string) => void;
  appendStreamBuffer: (text: string, chatId?: string) => void;
  setStreamBuffer: (text: string, chatId?: string) => void;
  clearStreamBuffer: (chatId?: string) => void;
  appendThinkingBuffer: (text: string, chatId?: string) => void;
  setThinkingBuffer: (text: string, chatId?: string) => void;
  clearThinkingBuffer: (chatId?: string) => void;
  setRegenerateMessageId: (id: string | null) => void;
  setStreamingCharacterId: (id: string | null) => void;
  setResponseQueue: (chatId: string, characterIds: string[]) => void;
  removeFromResponseQueue: (chatId: string, characterId: string) => void;
  completeQueuedResponse: (chatId: string, characterId: string | null | undefined) => void;
  clearResponseQueue: (chatId: string) => void;
  setTypingCharacterName: (name: string | null) => void;
  setGenerationPhase: (phase: string | null) => void;
  setDelayedCharacterInfo: (info: DelayedCharacterInfo | null) => void;
  setPerChatTyping: (chatId: string, name: string | null) => void;
  setPerChatDelayed: (chatId: string, info: DelayedCharacterInfo | null) => void;
  clearPerChatState: (chatId: string) => void;
  setSwipeIndex: (messageId: string, index: number) => void;
  setShouldOpenSettings: (v: boolean) => void;
  setShouldOpenWizard: (v: boolean) => void;
  setShouldOpenWizardInShortcutMode: (v: boolean) => void;
  setPendingNewChatMode: (mode: Exclude<ChatMode, "visual_novel"> | null) => void;
  setInputDraft: (chatId: string, text: string) => void;
  clearInputDraft: (chatId: string) => void;
  setCurrentInput: (text: string) => void;
  incrementUnread: (chatId: string) => void;
  hydrateUnread: (
    unread: Array<{
      chatId: string;
      count: number;
      characterName: string;
      avatarUrl: string | null;
      avatarCrop?: NotificationAvatarCrop;
    }>,
    knownChatIds?: string[],
  ) => void;
  clearUnread: (chatId: string) => void;
  addNotification: (
    chatId: string,
    characterName: string,
    avatarUrl: string | null,
    avatarCrop?: NotificationAvatarCrop,
  ) => void;
  autoDismissNotification: (chatId: string) => void;
  dismissNotification: (chatId: string) => void;
  dismissNotifications: (chatIds: string[]) => void;
  requestGotoMessage: (chatId: string, messageNumber: number) => void;
  clearGotoRequest: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    activeChatId: (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) || null;
      } catch {
        return null;
      }
    })(),
    activeChat: null,
    messages: [],
    isStreaming: false,
    streamingChatId: null,
    mariPhaseByChatId: new Map(),
    streamBuffer: "",
    streamBuffers: new Map(),
    committedStreamChatIds: new Set(),
    thinkingBuffer: "",
    thinkingBuffers: new Map(),
    abortControllers: new Map(),
    regenerateMessageId: null,
    streamingCharacterId: null,
    responseQueues: new Map(),
    typingCharacterName: null,
    generationPhase: null,
    delayedCharacterInfo: null,
    perChatTyping: new Map(),
    perChatDelayed: new Map(),
    swipeIndex: new Map(),
    shouldOpenSettings: false,
    shouldOpenWizard: false,
    shouldOpenWizardInShortcutMode: false,
    pendingNewChatMode: null,
    inputDrafts: loadDrafts(),
    currentInput: "",
    unreadCounts: new Map(),
    chatNotifications: new Map(),
    dismissedNotifications: new Set(),
    gotoRequest: null,

    setActiveChat: (chat) => set({ activeChat: chat }),
    setActiveChatId: (id) => {
      const prev = get().activeChatId;
      // Clear unread for the chat being opened
      if (id) {
        set((state) => {
          const hasUnread = state.unreadCounts.has(id);
          const hasNotif = state.chatNotifications.has(id);
          const hasDismissed = state.dismissedNotifications.has(id);
          if (!hasUnread && !hasNotif && !hasDismissed) return {};
          const m = hasUnread ? new Map(state.unreadCounts) : state.unreadCounts;
          if (hasUnread) m.delete(id);
          const n = hasNotif ? new Map(state.chatNotifications) : state.chatNotifications;
          if (hasNotif) {
            clearNotificationTimer(id);
            n.delete(id);
          }
          const d = hasDismissed ? new Set(state.dismissedNotifications) : state.dismissedNotifications;
          if (hasDismissed) d.delete(id);
          return { unreadCounts: m, chatNotifications: n, dismissedNotifications: d };
        });
      }
      set({ activeChatId: id, swipeIndex: new Map(), ...(!id && { activeChat: null }) });
      // Only reset agent + game state when actually switching chats — re-selecting the
      // same chat should not blow away loaded tracker data.
      if (id !== prev) {
        useAgentStore.getState().reset();
        useGameStateStore.getState().setGameState(null);
        // Background is NOT cleared here — it's managed by ChatArea's restore effect.
        // Clearing it would cause a black flash and wipe the background for new chats.
        // Restore per-chat typing/delayed indicators for the newly active chat
        if (id) {
          const { perChatTyping, perChatDelayed, abortControllers, streamBuffers, thinkingBuffers } = get();
          const typing = perChatTyping.get(id) ?? null;
          const delayed = perChatDelayed.get(id) ?? null;
          // If this chat has an active generation, restore streaming state so the
          // UI shows the typing indicator, stream buffer, and stop button.
          const hasActiveGeneration = abortControllers.has(id);
          set({
            typingCharacterName: typing,
            delayedCharacterInfo: delayed,
            isStreaming: hasActiveGeneration,
            streamingChatId: hasActiveGeneration ? id : null,
            streamBuffer: hasActiveGeneration ? (streamBuffers.get(id) ?? "") : "",
            thinkingBuffer: hasActiveGeneration ? (thinkingBuffers.get(id) ?? "") : "",
          });
        } else {
          set({
            typingCharacterName: null,
            delayedCharacterInfo: null,
            isStreaming: false,
            streamingChatId: null,
            streamBuffer: "",
            thinkingBuffer: "",
          });
        }
      }
      try {
        if (id) localStorage.setItem(STORAGE_KEY, id);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
    setMessages: (messages) => set({ messages }),

    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

    updateLastMessage: (content) =>
      set((state) => {
        const messages = [...state.messages];
        const last = messages[messages.length - 1];
        if (last) {
          messages[messages.length - 1] = { ...last, content };
        }
        return { messages };
      }),

    setStreaming: (streaming, chatId) =>
      set((state) => {
        const committed = new Set(state.committedStreamChatIds);
        const targetChatId = chatId ?? state.streamingChatId;
        if (targetChatId) committed.delete(targetChatId);
        return {
          isStreaming: streaming,
          streamingChatId: streaming ? (chatId ?? null) : null,
          committedStreamChatIds: committed,
          ...(!streaming ? { generationPhase: null } : {}),
        };
      }),
    setStreamCommitted: (chatId, committed) =>
      set((state) => {
        const next = new Set(state.committedStreamChatIds);
        if (committed) next.add(chatId);
        else next.delete(chatId);
        return { committedStreamChatIds: next };
      }),
    setMariPhase: (chatId, phase) =>
      set((state) => {
        const current = state.mariPhaseByChatId.get(chatId) ?? null;
        if (phase === "idle") {
          if (current === null) return state;
          const next = new Map(state.mariPhaseByChatId);
          next.delete(chatId);
          return { mariPhaseByChatId: next };
        }
        if (current === phase) return state;
        const next = new Map(state.mariPhaseByChatId);
        next.set(chatId, phase);
        return { mariPhaseByChatId: next };
      }),
    setAbortController: (chatId, controller) =>
      set((state) => {
        const m = new Map(state.abortControllers);
        if (controller) m.set(chatId, controller);
        else m.delete(chatId);
        return { abortControllers: m };
      }),
    stopGeneration: (chatId) => {
      const { activeChatId, streamingChatId, abortControllers } = useChatStore.getState();
      const targetIds = chatId
        ? [chatId]
        : activeChatId && abortControllers.has(activeChatId)
          ? [activeChatId]
          : streamingChatId
            ? [streamingChatId]
            : [...abortControllers.keys()];
      for (const targetChatId of new Set(targetIds)) {
        abortGenerationForChat(targetChatId, abortControllers.get(targetChatId));
      }
    },
    appendStreamBuffer: (text, chatId) =>
      set((state) => {
        const targetChatId = chatId ?? state.streamingChatId ?? state.activeChatId ?? "";
        if (!targetChatId) return { streamBuffer: state.streamBuffer + text };
        const nextText = (state.streamBuffers.get(targetChatId) ?? "") + text;
        const buffers = new Map(state.streamBuffers);
        buffers.set(targetChatId, nextText);
        return {
          streamBuffers: buffers,
          ...(state.activeChatId === targetChatId ? { streamBuffer: nextText } : {}),
        };
      }),
    setStreamBuffer: (text, chatId) =>
      set((state) => {
        const targetChatId = chatId ?? state.streamingChatId ?? state.activeChatId ?? "";
        if (!targetChatId) return { streamBuffer: text };
        const buffers = new Map(state.streamBuffers);
        if (text) buffers.set(targetChatId, text);
        else buffers.delete(targetChatId);
        return {
          streamBuffers: buffers,
          ...(state.activeChatId === targetChatId ? { streamBuffer: text } : {}),
        };
      }),
    clearStreamBuffer: (chatId) =>
      set((state) => {
        const targetChatId = chatId ?? state.streamingChatId ?? state.activeChatId ?? "";
        if (!targetChatId) return { streamBuffer: "", streamBuffers: new Map() };
        const buffers = new Map(state.streamBuffers);
        buffers.delete(targetChatId);
        return {
          streamBuffers: buffers,
          ...(state.activeChatId === targetChatId ? { streamBuffer: "" } : {}),
        };
      }),
    appendThinkingBuffer: (text, chatId) =>
      set((state) => {
        const targetChatId = chatId ?? state.streamingChatId ?? state.activeChatId ?? "";
        if (!targetChatId) return { thinkingBuffer: state.thinkingBuffer + text };
        const nextText = (state.thinkingBuffers.get(targetChatId) ?? "") + text;
        const buffers = new Map(state.thinkingBuffers);
        buffers.set(targetChatId, nextText);
        return {
          thinkingBuffers: buffers,
          ...(state.activeChatId === targetChatId ? { thinkingBuffer: nextText } : {}),
        };
      }),
    setThinkingBuffer: (text, chatId) =>
      set((state) => {
        const targetChatId = chatId ?? state.streamingChatId ?? state.activeChatId ?? "";
        if (!targetChatId) return { thinkingBuffer: text };
        const buffers = new Map(state.thinkingBuffers);
        if (text) buffers.set(targetChatId, text);
        else buffers.delete(targetChatId);
        return {
          thinkingBuffers: buffers,
          ...(state.activeChatId === targetChatId ? { thinkingBuffer: text } : {}),
        };
      }),
    clearThinkingBuffer: (chatId) =>
      set((state) => {
        const targetChatId = chatId ?? state.streamingChatId ?? state.activeChatId ?? "";
        if (!targetChatId) return { thinkingBuffer: "", thinkingBuffers: new Map() };
        const buffers = new Map(state.thinkingBuffers);
        buffers.delete(targetChatId);
        return {
          thinkingBuffers: buffers,
          ...(state.activeChatId === targetChatId ? { thinkingBuffer: "" } : {}),
        };
      }),

    setRegenerateMessageId: (id) => set({ regenerateMessageId: id }),

    setStreamingCharacterId: (id) => set({ streamingCharacterId: id }),

    setResponseQueue: (chatId, characterIds) =>
      set((state) => {
        const unique = characterIds.filter((id, index) => id && characterIds.indexOf(id) === index);
        const queues = new Map(state.responseQueues);
        if (unique.length > 0) queues.set(chatId, unique);
        else queues.delete(chatId);
        return { responseQueues: queues };
      }),

    removeFromResponseQueue: (chatId, characterId) =>
      set((state) => {
        const current = state.responseQueues.get(chatId) ?? [];
        if (!current.includes(characterId)) return state;
        const nextQueue = current.filter((id) => id !== characterId);
        const queues = new Map(state.responseQueues);
        if (nextQueue.length > 0) queues.set(chatId, nextQueue);
        else queues.delete(chatId);
        return { responseQueues: queues };
      }),

    completeQueuedResponse: (chatId, characterId) =>
      set((state) => {
        if (!characterId) return state;
        const current = state.responseQueues.get(chatId) ?? [];
        if (current[0] !== characterId) return state;
        const queues = new Map(state.responseQueues);
        const nextQueue = current.slice(1);
        if (nextQueue.length > 0) queues.set(chatId, nextQueue);
        else queues.delete(chatId);
        return { responseQueues: queues };
      }),

    clearResponseQueue: (chatId) =>
      set((state) => {
        if (!state.responseQueues.has(chatId)) return state;
        const queues = new Map(state.responseQueues);
        queues.delete(chatId);
        return { responseQueues: queues };
      }),

    setTypingCharacterName: (name) =>
      set((state) => {
        if (state.typingCharacterName === name && state.delayedCharacterInfo === null) return state;
        return { typingCharacterName: name, delayedCharacterInfo: null };
      }),

    setGenerationPhase: (phase) =>
      set((state) => {
        if (state.generationPhase === phase) return state;
        return { generationPhase: phase };
      }),

    setDelayedCharacterInfo: (info) =>
      set((state) => {
        if (state.delayedCharacterInfo === info && state.typingCharacterName === null) return state;
        return { delayedCharacterInfo: info, typingCharacterName: null };
      }),

    setPerChatTyping: (chatId: string, name: string | null) =>
      set((state) => {
        const currentTyping = state.perChatTyping.get(chatId) ?? null;
        if (name === null && currentTyping === null) return state;
        if (name !== null && currentTyping === name && !state.perChatDelayed.has(chatId)) return state;
        const m = new Map(state.perChatTyping);
        if (name) m.set(chatId, name);
        else m.delete(chatId);
        const d = new Map(state.perChatDelayed);
        if (name) d.delete(chatId); // typing clears delayed
        return { perChatTyping: m, perChatDelayed: d };
      }),

    setPerChatDelayed: (chatId: string, info: DelayedCharacterInfo | null) =>
      set((state) => {
        const currentDelayed = state.perChatDelayed.get(chatId) ?? null;
        if (info === null && currentDelayed === null) return state;
        if (info !== null && currentDelayed === info && !state.perChatTyping.has(chatId)) return state;
        const d = new Map(state.perChatDelayed);
        if (info) d.set(chatId, info);
        else d.delete(chatId);
        const t = new Map(state.perChatTyping);
        if (info) t.delete(chatId);
        return { perChatDelayed: d, perChatTyping: t };
      }),

    clearPerChatState: (chatId: string) =>
      set((state) => {
        const t = new Map(state.perChatTyping);
        const d = new Map(state.perChatDelayed);
        const thoughts = new Map(state.thinkingBuffers);
        const committed = new Set(state.committedStreamChatIds);
        t.delete(chatId);
        d.delete(chatId);
        thoughts.delete(chatId);
        committed.delete(chatId);
        return {
          perChatTyping: t,
          perChatDelayed: d,
          thinkingBuffers: thoughts,
          committedStreamChatIds: committed,
          ...(state.activeChatId === chatId ? { thinkingBuffer: "" } : {}),
        };
      }),

    setShouldOpenSettings: (v) => set({ shouldOpenSettings: v }),

    setShouldOpenWizard: (v) => set({ shouldOpenWizard: v }),

    setShouldOpenWizardInShortcutMode: (v) => set({ shouldOpenWizardInShortcutMode: v }),

    setPendingNewChatMode: (mode) => set({ pendingNewChatMode: mode }),

    setInputDraft: (chatId: string, text: string) =>
      set((state) => {
        const m = new Map(state.inputDrafts);
        if (text) m.set(chatId, text);
        else m.delete(chatId);
        saveDrafts(m);
        return { inputDrafts: m };
      }),
    clearInputDraft: (chatId: string) =>
      set((state) => {
        if (!state.inputDrafts.has(chatId)) return state;
        const m = new Map(state.inputDrafts);
        m.delete(chatId);
        saveDrafts(m);
        return { inputDrafts: m };
      }),

    setCurrentInput: (text) => set({ currentInput: text }),

    incrementUnread: (chatId: string) =>
      set((state) => {
        const m = new Map(state.unreadCounts);
        m.set(chatId, (m.get(chatId) || 0) + 1);
        return { unreadCounts: m };
      }),
    hydrateUnread: (unread, knownChatIds) =>
      set((state) => {
        const unreadCounts = new Map(state.unreadCounts);
        const chatNotifications = new Map(state.chatNotifications);
        const serverChatIds = new Set<string>();
        const known = knownChatIds ? new Set(knownChatIds) : null;

        for (const item of unread) {
          if (item.count <= 0 || state.activeChatId === item.chatId) continue;
          serverChatIds.add(item.chatId);
          unreadCounts.set(item.chatId, item.count);
          if (!state.dismissedNotifications.has(item.chatId)) {
            chatNotifications.set(item.chatId, {
              chatId: item.chatId,
              characterName: item.characterName,
              avatarUrl: item.avatarUrl,
              avatarCrop: item.avatarCrop ?? null,
              count: item.count,
            });
          }
        }

        if (known) {
          for (const chatId of Array.from(unreadCounts.keys())) {
            if (!known.has(chatId) || !serverChatIds.has(chatId)) {
              unreadCounts.delete(chatId);
            }
          }
          for (const chatId of Array.from(chatNotifications.keys())) {
            if (!known.has(chatId) || !serverChatIds.has(chatId)) {
              clearNotificationTimer(chatId);
              chatNotifications.delete(chatId);
            }
          }
        }

        return { unreadCounts, chatNotifications };
      }),
    clearUnread: (chatId: string) =>
      set((state) => {
        if (!state.unreadCounts.has(chatId)) return state;
        const m = new Map(state.unreadCounts);
        m.delete(chatId);
        return { unreadCounts: m };
      }),
    addNotification: (chatId, characterName, avatarUrl, avatarCrop) =>
      set((state) => {
        // Don't add if this chat is currently active or was dismissed
        if (state.activeChatId === chatId) {
          clearNotificationTimer(chatId);
          return state;
        }
        if (state.dismissedNotifications.has(chatId)) {
          clearNotificationTimer(chatId);
          return state;
        }
        const m = new Map(state.chatNotifications);
        const existing = m.get(chatId);
        m.set(chatId, {
          chatId,
          characterName,
          avatarUrl,
          avatarCrop: avatarCrop ?? existing?.avatarCrop ?? null,
          count: (existing?.count ?? 0) + 1,
        });
        scheduleNotificationAutoDismiss(chatId, get);
        return { chatNotifications: m };
      }),
    autoDismissNotification: (chatId) =>
      set((state) => {
        clearNotificationTimer(chatId);
        if (!state.chatNotifications.has(chatId)) return state;
        const m = new Map(state.chatNotifications);
        m.delete(chatId);
        return { chatNotifications: m };
      }),
    dismissNotification: (chatId) =>
      set((state) => {
        clearNotificationTimer(chatId);
        const m = new Map(state.chatNotifications);
        m.delete(chatId);
        const d = new Set(state.dismissedNotifications);
        d.add(chatId);
        return { chatNotifications: m, dismissedNotifications: d };
      }),
    dismissNotifications: (chatIds) =>
      set((state) => {
        if (chatIds.length === 0) return state;
        const m = new Map(state.chatNotifications);
        const d = new Set(state.dismissedNotifications);
        for (const chatId of chatIds) {
          clearNotificationTimer(chatId);
          m.delete(chatId);
          d.add(chatId);
        }
        return { chatNotifications: m, dismissedNotifications: d };
      }),

    requestGotoMessage: (chatId, messageNumber) =>
      set((state) => ({
        gotoRequest: {
          chatId,
          messageNumber,
          token: (state.gotoRequest?.token ?? 0) + 1,
        },
      })),
    clearGotoRequest: () => set({ gotoRequest: null }),

    setSwipeIndex: (messageId: string, index: number) =>
      set((state) => {
        const m = new Map(state.swipeIndex);
        m.set(messageId, index);
        return { swipeIndex: m };
      }),

    reset: () => {
      const { abortControllers } = useChatStore.getState();
      for (const [chatId, controller] of abortControllers) {
        abortGenerationForChat(chatId, controller);
      }
      clearAllNotificationTimers();
      set({
        activeChatId: null,
        activeChat: null,
        messages: [],
        isStreaming: false,
        streamingChatId: null,
        mariPhaseByChatId: new Map(),
        streamBuffer: "",
        streamBuffers: new Map(),
        committedStreamChatIds: new Set(),
        thinkingBuffer: "",
        thinkingBuffers: new Map(),
        abortControllers: new Map(),
        regenerateMessageId: null,
        streamingCharacterId: null,
        responseQueues: new Map(),
        typingCharacterName: null,
        generationPhase: null,
        delayedCharacterInfo: null,
        perChatTyping: new Map(),
        perChatDelayed: new Map(),
        swipeIndex: new Map(),
        pendingNewChatMode: null,
        inputDrafts: new Map(),
        currentInput: "",
        unreadCounts: new Map(),
        chatNotifications: new Map(),
        dismissedNotifications: new Set(),
        gotoRequest: null,
      });
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DRAFTS_KEY);
        sessionStorage.removeItem(DRAFTS_KEY);
      } catch {
        /* ignore */
      }
    },
  })),
);
