import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentStore } from "../../../../shared/stores/agent.store";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { runGenerationWithUi, type GenerateArgs } from "./use-generate";

const storageApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));
const worldStateApiMock = vi.hoisted(() => ({
  get: vi.fn(async () => null),
  patch: vi.fn(async (_chatId: string, patch: unknown) => patch),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: storageApiMock,
}));

vi.mock("../../../../shared/api/llm-api", () => ({
  llmApi: { complete: vi.fn(), stream: vi.fn(), listModels: vi.fn() },
}));

vi.mock("../../../../shared/api/integration-gateway", () => ({
  integrationGateway: {
    customTools: {},
    discord: { mirrorMessage: vi.fn() },
    haptic: { command: vi.fn() },
    image: { generate: vi.fn() },
    spotify: {},
  },
}));

vi.mock("../../../../shared/components/ui/ImagePromptReviewHost", () => ({
  requestImagePromptReview: vi.fn(),
}));

vi.mock("../../world-state/index", () => ({
  useGameStateStore: {
    getState: () => ({
      current: null,
      setGameState: vi.fn(),
    }),
  },
  worldStateApi: worldStateApiMock,
}));

vi.mock("../../../catalog/chats/index", () => ({
  chatKeys: {
    all: ["chats"],
    list: () => ["chats", "list"],
    detail: (id: string) => ["chats", "detail", id],
    messages: (chatId: string) => ["chats", "messages", chatId],
    messageCount: (chatId: string) => ["chats", "messageCount", chatId],
  },
  sanitizeTimelineMessage: (message: unknown) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) return message;
    const { swipes: _swipes, ...withoutSwipes } = message as Record<string, unknown>;
    const extra =
      withoutSwipes.extra && typeof withoutSwipes.extra === "object" && !Array.isArray(withoutSwipes.extra)
        ? (withoutSwipes.extra as Record<string, unknown>)
        : {};
    const { generationPromptSnapshotsBySwipe: _generationPromptSnapshotsBySwipe, ...timelineExtra } = extra;
    return { ...withoutSwipes, extra: timelineExtra };
  },
  sanitizeTimelineMessageRecord: (record: Record<string, unknown>) => {
    const { swipes: _swipes, ...withoutSwipes } = record;
    const extra =
      withoutSwipes.extra && typeof withoutSwipes.extra === "object" && !Array.isArray(withoutSwipes.extra)
        ? (withoutSwipes.extra as Record<string, unknown>)
        : {};
    const { generationPromptSnapshotsBySwipe: _generationPromptSnapshotsBySwipe, ...timelineExtra } = extra;
    return { ...withoutSwipes, extra: timelineExtra };
  },
  timelineMessageProjection: (options: Record<string, unknown> = {}) => ({
    ...options,
    fields: ["id", "chatId", "role", "content", "characterId", "activeSwipeIndex", "swipeCount", "extra", "createdAt"],
    fieldSelections: { extra: ["generationReplay", "generationPromptSnapshot"] },
  }),
}));

vi.mock("../../../catalog/characters/index", () => ({
  characterKeys: {
    list: () => ["characters", "list"],
  },
}));

vi.mock("../../../catalog/lorebooks/index", () => ({
  applyLorebookKeeperUpdate: vi.fn(),
  buildPendingLorebookUpdates: vi.fn(async () => []),
  lorebookKeeperReviewRequired: vi.fn(() => false),
  lorebookKeys: {
    active: () => ["lorebooks", "active"],
    entries: (lorebookId?: string) => ["lorebooks", "entries", lorebookId ?? ""],
  },
}));

type StreamEvent = { type: string; data?: unknown };
type TestStreamFactory = (args: GenerateArgs, signal: AbortSignal) => AsyncGenerator<StreamEvent>;

function queryClientWithChat(chatId = "chat-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(["chats", "detail", chatId], {
    id: chatId,
    mode: "roleplay",
    metadata: {},
  });
  return queryClient;
}

describe("runGenerationWithUi", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    storageApiMock.get.mockReset();
    worldStateApiMock.get.mockClear();
    worldStateApiMock.patch.mockClear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useChatStore.getState().reset();
    useChatStore.getState().setActiveChatId("chat-1");
    useAgentStore.getState().reset();
    useUIStore.getState().setEnableStreaming(false);
    useUIStore.getState().setStreamingSpeed(100);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    warnSpy.mockRestore();
    useChatStore.getState().reset();
    useAgentStore.getState().reset();
  });

  it("does not replace an active same-chat generation controller", async () => {
    const queryClient = queryClientWithChat();
    const existing = new AbortController();
    useChatStore.getState().setAbortController("chat-1", existing);
    useChatStore.getState().setStreaming(true, "chat-1");
    useAgentStore.getState().setProcessing(true);

    const streamFactory = vi.fn<TestStreamFactory>(async function* () {
      yield { type: "done" };
    });

    await expect(runGenerationWithUi(queryClient, { chatId: "chat-1" }, streamFactory)).resolves.toBe(false);

    expect(streamFactory).not.toHaveBeenCalled();
    expect(useChatStore.getState().abortControllers.get("chat-1")).toBe(existing);
    expect(useChatStore.getState().isStreaming).toBe(true);
    expect(useAgentStore.getState().isProcessing).toBe(true);
  });

  it("cleans up its own controller and visible streaming state when generation finishes", async () => {
    const queryClient = queryClientWithChat();

    const streamFactory = vi.fn<TestStreamFactory>(async function* () {
      yield { type: "token", data: "Hello" };
      yield { type: "done" };
    });

    await expect(runGenerationWithUi(queryClient, { chatId: "chat-1" }, streamFactory)).resolves.toBe(true);

    const state = useChatStore.getState();
    expect(state.abortControllers.has("chat-1")).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(state.streamingChatId).toBe(null);
    expect(state.streamBuffer).toBe("Hello");
    expect(useAgentStore.getState().isProcessing).toBe(false);
  });

  it("does not clear a newer same-chat controller from stale cleanup", async () => {
    const queryClient = queryClientWithChat();
    const newer = new AbortController();

    const streamFactory = vi.fn<TestStreamFactory>(async function* () {
      useChatStore.getState().setAbortController("chat-1", newer);
      useChatStore.getState().setStreaming(true, "chat-1");
      useAgentStore.getState().setProcessing(true);
      yield { type: "token", data: "stale" };
    });

    await expect(runGenerationWithUi(queryClient, { chatId: "chat-1" }, streamFactory)).resolves.toBe(false);

    const state = useChatStore.getState();
    expect(state.abortControllers.get("chat-1")).toBe(newer);
    expect(state.isStreaming).toBe(true);
    expect(state.streamBuffer).toBe("");
    expect(useAgentStore.getState().isProcessing).toBe(true);
  });

  it("defers live agent result effects until generation UI cleanup", async () => {
    const queryClient = queryClientWithChat();

    const streamFactory = vi.fn<TestStreamFactory>(async function* () {
      yield {
        type: "agent_result",
        data: {
          agentId: "world-state",
          agentType: "world-state",
          type: "game_state_update",
          data: { location: "Primary Examination Theater" },
          success: true,
          error: null,
          tokensUsed: 12,
          durationMs: 4,
        },
      };
      yield { type: "token", data: "Hello" };
      yield { type: "done" };
    });

    await expect(runGenerationWithUi(queryClient, { chatId: "chat-1" }, streamFactory)).resolves.toBe(true);

    expect(useAgentStore.getState().isProcessing).toBe(false);
    expect(useAgentStore.getState().lastResults.size).toBe(0);

    await vi.runOnlyPendingTimersAsync();

    expect(useAgentStore.getState().lastResults.get("world-state")).toMatchObject({
      agentType: "world-state",
      success: true,
    });
    expect(worldStateApiMock.patch).not.toHaveBeenCalled();
  });

  it("releases foreground generation after the saved assistant message while background events continue", async () => {
    const queryClient = queryClientWithChat();
    let resolveAfterAssistantHandled: () => void = () => undefined;
    let resolveBackground: () => void = () => undefined;
    const afterAssistantHandled = new Promise<void>((resolve) => {
      resolveAfterAssistantHandled = resolve;
    });
    const backgroundGate = new Promise<void>((resolve) => {
      resolveBackground = resolve;
    });

    const streamFactory = vi.fn<TestStreamFactory>(async function* () {
      yield { type: "token", data: "Hello" };
      yield {
        type: "assistant_message",
        data: {
          id: "message-1",
          chatId: "chat-1",
          role: "assistant",
          content: "Hello",
          extra: {},
        },
      };
      resolveAfterAssistantHandled();
      await backgroundGate;
      yield { type: "illustration", data: { galleryId: "gallery-1" } };
      yield { type: "done" };
    });

    const generation = runGenerationWithUi(queryClient, { chatId: "chat-1" }, streamFactory);
    await afterAssistantHandled;

    const state = useChatStore.getState();
    expect(state.abortControllers.has("chat-1")).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(state.streamingChatId).toBe(null);
    expect(state.streamBuffer).toBe("Hello");
    expect(useAgentStore.getState().isProcessing).toBe(false);

    resolveBackground();
    await expect(generation).resolves.toBe(true);
  });

  it("keeps regenerated assistant message cache updates free of inactive swipe payloads", async () => {
    const queryClient = queryClientWithChat();
    queryClient.setQueryData(["chats", "messages", "chat-1"], {
      pages: [
        [
          {
            id: "assistant-1",
            chatId: "chat-1",
            role: "assistant",
            characterId: null,
            content: "Old swipe.",
            activeSwipeIndex: 0,
            swipeCount: 4,
            createdAt: "2026-05-30T00:00:00.000Z",
            extra: {},
          },
        ],
      ],
      pageParams: [undefined],
    });
    const savedPromptSnapshot = {
      messages: [{ role: "user", content: "Hello" }],
      parameters: { temperature: 0.7 },
    };

    const streamFactory = vi.fn<TestStreamFactory>(async function* () {
      yield { type: "token", data: "New swipe." };
      yield {
        type: "assistant_message",
        data: {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "New swipe.",
          characterId: null,
          activeSwipeIndex: 3,
          swipeCount: 4,
          createdAt: "2026-05-30T00:00:00.000Z",
          swipes: [
            { content: "Old swipe.", extra: { generationPromptSnapshot: { messages: [], parameters: {} } } },
            { content: "Second swipe.", extra: { generationPromptSnapshot: { messages: [], parameters: {} } } },
            { content: "Third swipe.", extra: { generationPromptSnapshot: { messages: [], parameters: {} } } },
            { content: "New swipe.", extra: { generationPromptSnapshot: savedPromptSnapshot } },
          ],
          extra: {
            thinking: "brief thoughts",
            generationPromptSnapshot: savedPromptSnapshot,
            generationPromptSnapshotsBySwipe: {
              "3": savedPromptSnapshot,
            },
          },
        },
      };
      yield { type: "done" };
    });

    await expect(
      runGenerationWithUi(
        queryClient,
        { chatId: "chat-1", regenerateMessageId: "assistant-1" },
        streamFactory,
      ),
    ).resolves.toBe(true);

    const cached = queryClient.getQueryData<{ pages: Array<Array<Record<string, unknown>>> }>([
      "chats",
      "messages",
      "chat-1",
    ]);
    const message = cached?.pages[0]?.[0];
    expect(message).toMatchObject({
      id: "assistant-1",
      content: "New swipe.",
      activeSwipeIndex: 3,
      swipeCount: 4,
    });
    expect(message).not.toHaveProperty("swipes");
    expect(message?.extra).toMatchObject({
      thinking: "brief thoughts",
      generationPromptSnapshot: savedPromptSnapshot,
    });
    expect(message?.extra).not.toHaveProperty("generationPromptSnapshotsBySwipe");
  });

  it("updates generation phase for tool call and tool result stream events without appending them as text", async () => {
    const queryClient = queryClientWithChat();
    const observedPhases: Array<string | null> = [];

    const streamFactory = vi.fn<TestStreamFactory>(async function* () {
      yield { type: "tool_call", data: { id: "call-1", name: "roll_dice", arguments: "{}" } };
      observedPhases.push(useChatStore.getState().generationPhase);
      yield { type: "tool_result", data: { toolCallId: "call-1", name: "roll_dice", result: "4", success: true } };
      observedPhases.push(useChatStore.getState().generationPhase);
      yield { type: "token", data: "Rolled a 4." };
      yield { type: "done" };
    });

    await expect(runGenerationWithUi(queryClient, { chatId: "chat-1" }, streamFactory)).resolves.toBe(true);

    expect(observedPhases).toEqual(["Running tool: roll_dice...", "Tool finished: roll_dice."]);
    expect(useChatStore.getState().streamBuffer).toBe("Rolled a 4.");
  });
});
