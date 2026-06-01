// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, Message } from "../../../../engine/contracts/types/chat";
import { chatCommandApi } from "../../../../shared/api/chat-command-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { showConversationLocalNotification } from "../../../../shared/lib/local-notifications";
import { playNotificationPing } from "../../../../shared/lib/notification-sound";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { chatKeys } from "../../../catalog/chats";
import { runGenerationWithUi, type GenerateArgs } from "./use-generate";

vi.mock("../../../../shared/api/chat-command-api", () => ({
  chatCommandApi: {
    markAutonomousUnread: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    get: vi.fn(),
  },
}));

vi.mock("../../../../shared/lib/local-notifications", () => ({
  showConversationLocalNotification: vi.fn(),
}));

vi.mock("../../../../shared/lib/notification-sound", () => ({
  playNotificationPing: vi.fn(),
}));

vi.mock("../../world-state/index", () => ({
  useGameStateStore: {
    getState: () => ({ setGameState: vi.fn() }),
  },
  worldStateApi: {
    get: vi.fn().mockResolvedValue(null),
  },
}));

const markAutonomousUnreadMock = vi.mocked(chatCommandApi.markAutonomousUnread);
const storageGetMock = vi.mocked(storageApi.get);
const showConversationLocalNotificationMock = vi.mocked(showConversationLocalNotification);
const playNotificationPingMock = vi.mocked(playNotificationPing);

function chat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "chat-1",
    name: "Chat",
    mode: "conversation",
    characterIds: ["char-1"],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
    connectedChatId: null,
    folderId: null,
    sortOrder: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    metadata: {} as Chat["metadata"],
    ...overrides,
  };
}

function assistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    chatId: "chat-1",
    role: "assistant",
    characterId: "char-1",
    content: "Fresh reply",
    activeSwipeIndex: 0,
    createdAt: "2026-06-01T00:00:01.000Z",
    extra: {} as Message["extra"],
    ...overrides,
  };
}

async function* stream(events: Array<{ type: string; data?: unknown }>) {
  for (const event of events) {
    yield event;
  }
}

async function runAssistantMessage(queryClient: QueryClient, args: GenerateArgs, message: Message) {
  return runGenerationWithUi(queryClient, args, () => stream([{ type: "assistant_message", data: message }]));
}

describe("runGenerationWithUi notifications", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    useChatStore.getState().reset();
    useChatStore.getState().setActiveChatId("other-chat");
    useUIStore.setState({
      convoNotificationSound: true,
      rpNotificationSound: true,
      conversationBrowserNotifications: true,
    });
    markAutonomousUnreadMock.mockResolvedValue(chat());
    storageGetMock.mockImplementation(async (collection, id) => {
      if (collection === "characters" && id === "char-1") {
        return {
          id: "char-1",
          avatarPath: "/avatars/mari.png",
          data: {
            name: "Mari",
            extensions: { avatarCrop: { x: 1, y: 2, scale: 3 } },
          },
        };
      }
      throw new Error(`Unexpected storage get: ${String(collection)} ${String(id)}`);
    });
    showConversationLocalNotificationMock.mockResolvedValue(true);
  });

  afterEach(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    queryClient.clear();
    useChatStore.getState().reset();
    vi.clearAllMocks();
  });

  it("marks an off-chat Conversation generation unread and shows its avatar bubble", async () => {
    const currentChat = chat();
    const message = assistantMessage();
    queryClient.setQueryData(chatKeys.detail(currentChat.id), currentChat);
    queryClient.setQueryData(chatKeys.messages(currentChat.id), { pages: [[]], pageParams: [undefined] });

    await runAssistantMessage(queryClient, { chatId: currentChat.id }, message);

    const chatState = useChatStore.getState();
    expect(markAutonomousUnreadMock).toHaveBeenCalledWith(currentChat.id, { characterId: "char-1" });
    expect(chatState.unreadCounts.get(currentChat.id)).toBe(1);
    expect(chatState.chatNotifications.get(currentChat.id)).toMatchObject({
      chatId: currentChat.id,
      characterName: "Mari",
      avatarUrl: "/avatars/mari.png",
      avatarCrop: { x: 1, y: 2, scale: 3 },
      count: 1,
    });
    expect(playNotificationPingMock).toHaveBeenCalledTimes(1);
    expect(showConversationLocalNotificationMock).toHaveBeenCalledWith({
      enabled: true,
      characterName: "Mari",
      tag: `marinara-conversation-${currentChat.id}`,
    });
  });

  it("uses the Roleplay notification sound toggle for off-chat Roleplay generation", async () => {
    const currentChat = chat({ mode: "roleplay" });
    const message = assistantMessage();
    queryClient.setQueryData(chatKeys.detail(currentChat.id), currentChat);
    queryClient.setQueryData(chatKeys.messages(currentChat.id), { pages: [[]], pageParams: [undefined] });
    useUIStore.setState({ convoNotificationSound: false, rpNotificationSound: true });

    await runAssistantMessage(queryClient, { chatId: currentChat.id }, message);

    expect(playNotificationPingMock).toHaveBeenCalledTimes(1);
    expect(showConversationLocalNotificationMock).not.toHaveBeenCalled();
    expect(useChatStore.getState().unreadCounts.get(currentChat.id)).toBe(1);
  });

  it("does not notify when the generated chat is still active", async () => {
    const currentChat = chat();
    const message = assistantMessage();
    queryClient.setQueryData(chatKeys.detail(currentChat.id), currentChat);
    queryClient.setQueryData(chatKeys.messages(currentChat.id), { pages: [[]], pageParams: [undefined] });
    useChatStore.getState().setActiveChatId(currentChat.id);

    await runAssistantMessage(queryClient, { chatId: currentChat.id }, message);

    expect(markAutonomousUnreadMock).not.toHaveBeenCalled();
    expect(playNotificationPingMock).not.toHaveBeenCalled();
    expect(showConversationLocalNotificationMock).not.toHaveBeenCalled();
    expect(useChatStore.getState().unreadCounts.has(currentChat.id)).toBe(false);
    expect(useChatStore.getState().chatNotifications.has(currentChat.id)).toBe(false);
  });

  it("does not notify if the user returns before notification metadata resolves", async () => {
    const currentChat = chat();
    const message = assistantMessage();
    queryClient.setQueryData(chatKeys.detail(currentChat.id), currentChat);
    queryClient.setQueryData(chatKeys.messages(currentChat.id), { pages: [[]], pageParams: [undefined] });
    let resolveCharacter!: (value: unknown) => void;
    const characterPromise = new Promise((resolve) => {
      resolveCharacter = resolve;
    });
    storageGetMock.mockImplementation(async (collection, id) => {
      if (collection === "characters" && id === "char-1") return characterPromise;
      throw new Error(`Unexpected storage get: ${String(collection)} ${String(id)}`);
    });

    const generationPromise = runAssistantMessage(queryClient, { chatId: currentChat.id }, message);
    await Promise.resolve();
    useChatStore.getState().setActiveChatId(currentChat.id);
    resolveCharacter({
      id: "char-1",
      avatarPath: "/avatars/mari.png",
      data: { name: "Mari" },
    });
    await generationPromise;

    expect(markAutonomousUnreadMock).not.toHaveBeenCalled();
    expect(playNotificationPingMock).not.toHaveBeenCalled();
    expect(showConversationLocalNotificationMock).not.toHaveBeenCalled();
    expect(useChatStore.getState().unreadCounts.has(currentChat.id)).toBe(false);
    expect(useChatStore.getState().chatNotifications.has(currentChat.id)).toBe(false);
  });
});
