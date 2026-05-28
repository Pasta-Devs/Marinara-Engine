import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentStore } from "../../../../shared/stores/agent.store";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { runGenerationWithUi, type GenerateArgs } from "./use-generate";

const storageApiMock = vi.hoisted(() => ({
  get: vi.fn(),
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
  worldStateApi: {
    get: vi.fn(async () => null),
    patch: vi.fn(async (_chatId: string, patch: unknown) => patch),
  },
}));

vi.mock("../../../catalog/chats/index", () => ({
  chatKeys: {
    all: ["chats"],
    list: () => ["chats", "list"],
    detail: (id: string) => ["chats", "detail", id],
    messages: (chatId: string) => ["chats", "messages", chatId],
    messageCount: (chatId: string) => ["chats", "messageCount", chatId],
  },
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
});
