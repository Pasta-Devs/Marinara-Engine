// ──────────────────────────────────────────────
// Zustand Store: Chat Slice
// ──────────────────────────────────────────────
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Chat, Message } from "@marinara-engine/shared";
import { useAgentStore } from "./agent.store";
import { useGameStateStore } from "./game-state.store";
import { useUIStore } from "./ui.store";

const STORAGE_KEY = "marinara-active-chat-id";

interface ChatState {
  activeChatId: string | null;
  activeChat: Chat | null;
  messages: Message[];
  isStreaming: boolean;
  /** The chatId that the current streaming generation belongs to. */
  streamingChatId: string | null;
  streamBuffer: string;
  /** Active AbortController for the current generation — call .abort() to stop. */
  abortController: AbortController | null;
  /** When regenerating, the ID of the message being regenerated (so streaming shows in-place). */
  regenerateMessageId: string | null;
  /** During group chat individual mode, the character currently streaming. */
  streamingCharacterId: string | null;
  /** Character name(s) shown in typing indicator when generation is active. */
  typingCharacterName: string | null;
  /** Character name + status shown during DND/idle delay (before generation starts). */
  delayedCharacterInfo: { name: string; status: string } | null;
  swipeIndex: Map<string, number>; // messageId → active swipe index
  /** When true, ChatArea should open the settings drawer on next render. */
  shouldOpenSettings: boolean;
  /** When true, ChatArea should show the setup wizard for the newly created chat. */
  shouldOpenWizard: boolean;
  /** Per-chat draft input text so typing isn't lost when navigating away. */
  inputDrafts: Map<string, string>;
  /** Per-chat unread message count (from autonomous messages). */
  unreadCounts: Map<string, number>;

  // Actions
  setActiveChat: (chat: Chat | null) => void;
  setActiveChatId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setStreaming: (streaming: boolean, chatId?: string) => void;
  setAbortController: (controller: AbortController | null) => void;
  stopGeneration: () => void;
  appendStreamBuffer: (text: string) => void;
  setStreamBuffer: (text: string) => void;
  clearStreamBuffer: () => void;
  setRegenerateMessageId: (id: string | null) => void;
  setStreamingCharacterId: (id: string | null) => void;
  setTypingCharacterName: (name: string | null) => void;
  setDelayedCharacterInfo: (info: { name: string; status: string } | null) => void;
  setSwipeIndex: (messageId: string, index: number) => void;
  setShouldOpenSettings: (v: boolean) => void;
  setShouldOpenWizard: (v: boolean) => void;
  setInputDraft: (chatId: string, text: string) => void;
  clearInputDraft: (chatId: string) => void;
  incrementUnread: (chatId: string) => void;
  clearUnread: (chatId: string) => void;
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
    streamBuffer: "",
    abortController: null,
    regenerateMessageId: null,
    streamingCharacterId: null,
    typingCharacterName: null,
    delayedCharacterInfo: null,
    swipeIndex: new Map(),
    shouldOpenSettings: false,
    shouldOpenWizard: false,
    inputDrafts: new Map(),
    unreadCounts: new Map(),

    setActiveChat: (chat) => set({ activeChat: chat }),
    setActiveChatId: (id) => {
      const prev = get().activeChatId;
      // Clear unread for the chat being opened
      if (id) {
        set((state) => {
          if (!state.unreadCounts.has(id)) return {};
          const m = new Map(state.unreadCounts);
          m.delete(id);
          return { unreadCounts: m };
        });
      }
      set({ activeChatId: id, swipeIndex: new Map(), ...(!id && { activeChat: null }) });
      // Only reset agent + game state when actually switching chats — re-selecting the
      // same chat should not blow away loaded tracker data.
      if (id !== prev) {
        useAgentStore.getState().reset();
        useGameStateStore.getState().setGameState(null);
        useUIStore.getState().setChatBackground(null);
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
      set({ isStreaming: streaming, streamingChatId: streaming ? (chatId ?? null) : null }),
    setAbortController: (controller) => set({ abortController: controller }),
    stopGeneration: () => {
      const { abortController } = useChatStore.getState();
      if (abortController) abortController.abort();
    },
    appendStreamBuffer: (text) => set((state) => ({ streamBuffer: state.streamBuffer + text })),
    setStreamBuffer: (text) => set({ streamBuffer: text }),
    clearStreamBuffer: () => set({ streamBuffer: "" }),

    setRegenerateMessageId: (id) => set({ regenerateMessageId: id }),

    setStreamingCharacterId: (id) => set({ streamingCharacterId: id }),

    setTypingCharacterName: (name) => set({ typingCharacterName: name, delayedCharacterInfo: null }),

    setDelayedCharacterInfo: (info) => set({ delayedCharacterInfo: info, typingCharacterName: null }),

    setShouldOpenSettings: (v) => set({ shouldOpenSettings: v }),

    setShouldOpenWizard: (v) => set({ shouldOpenWizard: v }),

    setInputDraft: (chatId: string, text: string) =>
      set((state) => {
        const m = new Map(state.inputDrafts);
        if (text) m.set(chatId, text);
        else m.delete(chatId);
        return { inputDrafts: m };
      }),
    clearInputDraft: (chatId: string) =>
      set((state) => {
        if (!state.inputDrafts.has(chatId)) return state;
        const m = new Map(state.inputDrafts);
        m.delete(chatId);
        return { inputDrafts: m };
      }),

    incrementUnread: (chatId: string) =>
      set((state) => {
        const m = new Map(state.unreadCounts);
        m.set(chatId, (m.get(chatId) || 0) + 1);
        return { unreadCounts: m };
      }),
    clearUnread: (chatId: string) =>
      set((state) => {
        if (!state.unreadCounts.has(chatId)) return state;
        const m = new Map(state.unreadCounts);
        m.delete(chatId);
        return { unreadCounts: m };
      }),

    setSwipeIndex: (messageId: string, index: number) =>
      set((state) => {
        const m = new Map(state.swipeIndex);
        m.set(messageId, index);
        return { swipeIndex: m };
      }),

    reset: () => {
      set({
        activeChatId: null,
        activeChat: null,
        messages: [],
        isStreaming: false,
        streamBuffer: "",
        abortController: null,
        streamingCharacterId: null,
        typingCharacterName: null,
        delayedCharacterInfo: null,
        swipeIndex: new Map(),
        inputDrafts: new Map(),
        unreadCounts: new Map(),
      });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  })),
);
