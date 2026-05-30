import { describe, expect, it, vi } from "vitest";
import type { DiscordGateway, IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import type { VisualAssetGateway } from "../capabilities/visual-assets";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { retryGenerationAgents, startGeneration, type GenerationEngineDeps } from "./start-generation";

function mockDiscordMirror() {
  return vi.fn(<T = unknown>(_input: Parameters<DiscordGateway["mirrorMessage"]>[0]): Promise<T> => {
    return Promise.resolve({ success: true } as T);
  });
}

function depsForChat(chat: Record<string, unknown>) {
  const get = vi.fn(async (entity: string, id: string) => (entity === "chats" && id === "chat-1" ? chat : null));
  const createChatMessage = vi.fn(async () => {
    throw new Error("createChatMessage should not be called");
  });
  const storage = {
    get,
    createChatMessage,
  } as Partial<StorageGateway> as StorageGateway;
  const deps: GenerationEngineDeps = {
    storage,
    llm: {} as GenerationEngineDeps["llm"],
    integrations: {} as GenerationEngineDeps["integrations"],
  };
  return { deps, get, createChatMessage };
}

function generationDepsForChat(
  options: {
    savedUserMessage?: unknown;
    messagesAfterSave?: Record<string, unknown>[];
    chatPatch?: Record<string, unknown>;
    chatMetadata?: Record<string, unknown>;
    characters?: Record<string, unknown>[];
    personas?: Record<string, unknown>[];
    agents?: Record<string, unknown>[];
    agentRuns?: Record<string, unknown>[];
    initialMessages?: Record<string, unknown>[];
    connectionPatch?: Record<string, unknown>;
    prompts?: Record<string, unknown>[];
    promptSections?: Record<string, unknown>[];
    promptVariables?: Record<string, unknown>[];
    completeResponse?: string;
    streamResponses?: string[];
    integrations?: Partial<IntegrationGateway>;
    visuals?: VisualAssetGateway;
  } = {},
) {
  const chat = {
    id: "chat-1",
    mode: "conversation",
    connectionId: "connection-1",
    characterIds: [],
    metadata: options.chatMetadata ?? {},
    ...(options.chatPatch ?? {}),
  };
  const connection = {
    id: "connection-1",
    model: "test-model",
    defaultParameters: {},
    ...(options.connectionPatch ?? {}),
  };
  const initialMessages = options.initialMessages ?? [
    { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "What now?" },
  ];
  const messagesById = new Map(initialMessages.map((message) => [String(message.id), message]));
  const listChatMessages = vi.fn(async () =>
    listChatMessages.mock.calls.length > 1 && options.messagesAfterSave ? options.messagesAfterSave : initialMessages,
  );
  const streamedRequests: unknown[] = [];
  const completedRequests: unknown[] = [];
  const stream: LlmGateway["stream"] = vi.fn(async function* (request) {
    const response = options.streamResponses?.[streamedRequests.length] ?? "Done.";
    streamedRequests.push(request);
    yield { type: "token" as const, text: response };
  });
  const complete: LlmGateway["complete"] = vi.fn(async (request) => {
    completedRequests.push(request);
    return options.completeResponse ?? '{"characterIds":[]}';
  });
  const createChatMessage = vi.fn(async (_chatId: string, value: Record<string, unknown>) => {
    const saved =
      value.role === "user"
        ? (options.savedUserMessage ?? { id: "user-1", chatId: "chat-1", ...value })
        : { id: "assistant-2", chatId: "chat-1", ...value };
    if (saved && typeof saved === "object" && "id" in saved) {
      messagesById.set(String(saved.id), saved as Record<string, unknown>);
    }
    return saved;
  });
  const addChatMessageSwipe = vi.fn(
    async (
      _chatId: string,
      messageId: string,
      content: string,
      options?: { extra?: Record<string, unknown>; activate?: boolean },
    ) => ({
      ...(messagesById.get(messageId) ?? {}),
      content: options?.activate === false ? messagesById.get(messageId)?.content : content,
      activeSwipeIndex:
        options?.activate === false
          ? Number((messagesById.get(messageId)?.activeSwipeIndex as number | undefined) ?? 0)
          : 1,
      swipeCount: 2,
      extra: options?.activate === false ? messagesById.get(messageId)?.extra : options?.extra,
    }),
  );
  const patchChatMessageExtra = vi.fn(async (messageId: string, patch: Record<string, unknown>) => {
    const updated = {
      ...messagesById.get(messageId),
      extra: {
        ...((messagesById.get(messageId)?.extra as Record<string, unknown> | undefined) ?? {}),
        ...patch,
      },
    };
    messagesById.set(messageId, updated);
    return updated;
  });
  const storage = {
    get: vi.fn(async (entity: string, id: string) => {
      if (entity === "chats" && id === "chat-1") return chat;
      if (entity === "connections" && id === "connection-1") return connection;
      if (entity === "characters") return options.characters?.find((character) => character.id === id) ?? null;
      if (entity === "personas") return options.personas?.find((persona) => persona.id === id) ?? null;
      if (entity === "messages") return messagesById.get(id) ?? null;
      if (entity === "prompts") return options.prompts?.find((prompt) => prompt.id === id) ?? null;
      return null;
    }),
    list: vi.fn(async (entity: string, listOptions?: { filters?: Record<string, unknown> }) => {
      if (entity === "personas") return options.personas ?? [];
      if (entity === "agents") return options.agents ?? [];
      if (entity === "agent-runs") return options.agentRuns ?? [];
      if (entity === "prompts") return options.prompts ?? [];
      if (entity === "prompt-sections") {
        return (options.promptSections ?? []).filter((section) => section.presetId === listOptions?.filters?.presetId);
      }
      if (entity === "prompt-variables") {
        return (options.promptVariables ?? []).filter(
          (variable) => variable.presetId === listOptions?.filters?.presetId,
        );
      }
      return [];
    }),
    create: vi.fn(async (entity: string, value: Record<string, unknown>) => ({
      id: entity === "gallery" ? "gallery-1" : `${entity}-1`,
      ...value,
    })),
    createChatMessage,
    addChatMessageSwipe,
    patchChatMessageExtra,
    listChatMessages,
    listChatMemories: vi.fn(async () => []),
    listLorebookEntries: vi.fn(async () => []),
    saveTrackerSnapshot: vi.fn(async (_chatId: string, snapshot: Record<string, unknown>) => snapshot),
  } as Partial<StorageGateway> as StorageGateway;
  const deps: GenerationEngineDeps = {
    storage,
    llm: { stream, complete } as Partial<LlmGateway> as LlmGateway,
    integrations: (options.integrations ?? {}) as GenerationEngineDeps["integrations"],
    visuals: options.visuals,
  };
  return {
    deps,
    createChatMessage,
    addChatMessageSwipe,
    patchChatMessageExtra,
    listChatMessages,
    streamedRequests,
    completedRequests,
  };
}

async function drainGeneration(stream: AsyncGenerator<unknown>) {
  for await (const _event of stream) {
    // Exhaust the generator so storage and LLM calls finish.
  }
}

async function collectGeneration(stream: AsyncGenerator<unknown>): Promise<unknown[]> {
  const events: unknown[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

const illustratorDrawData = {
  shouldGenerate: true,
  reason: "Important visual beat",
  prompt: "moonlit tavern confrontation",
};

describe("startGeneration concluded roleplay guard", () => {
  it("rejects concluded roleplay scenes before saving user messages", async () => {
    const { deps, createChatMessage } = depsForChat({
      id: "chat-1",
      mode: "roleplay",
      metadata: { sceneStatus: "concluded" },
    });

    const stream = startGeneration(deps, { chatId: "chat-1", userMessage: "continue" });

    await expect(stream.next()).rejects.toThrow("This scene is concluded.");
    expect(createChatMessage).not.toHaveBeenCalled();
  });

  it("uses legacy chatMode and string metadata when guarding agent retries", async () => {
    const { deps } = depsForChat({
      id: "chat-1",
      chatMode: "roleplay",
      metadata: JSON.stringify({ sceneStatus: "concluded" }),
    });

    await expect(retryGenerationAgents(deps, { chatId: "chat-1" })).rejects.toThrow("This scene is concluded.");
  });

  it("rejects manual replies for inactive group characters before saving user messages", async () => {
    const { deps, createChatMessage } = depsForChat({
      id: "chat-1",
      mode: "roleplay",
      characterIds: ["char-active", "char-muted"],
      metadata: { inactiveCharacterIds: ["char-muted"] },
    });

    const stream = startGeneration(deps, { chatId: "chat-1", forCharacterId: "char-muted" });

    await expect(stream.next()).rejects.toThrow("This character is inactive");
    expect(createChatMessage).not.toHaveBeenCalled();
  });

  it("does not block non-roleplay chats that have concluded scene metadata", async () => {
    const { deps } = depsForChat({
      id: "chat-1",
      mode: "conversation",
      metadata: { sceneStatus: "concluded" },
    });

    const stream = startGeneration(deps, { chatId: "chat-1", userMessage: "continue" });

    await expect(stream.next()).resolves.toEqual({
      done: false,
      value: { type: "phase", data: "Saving message..." },
    });
    await stream.return(undefined);
  });
});

describe("startGeneration chat message loading", () => {
  it("does not save an assistant message when generation is stopped after tokens arrive", async () => {
    const controller = new AbortController();
    const { deps, createChatMessage } = generationDepsForChat();
    deps.llm.stream = vi.fn(async function* () {
      yield { type: "token" as const, text: "Partial reply." };
      controller.abort();
    });

    const events: Array<{ type: string; data?: unknown }> = [];
    let thrown: unknown = null;
    try {
      for await (const event of startGeneration(
        deps,
        {
          chatId: "chat-1",
          userMessage: "hello",
          impersonateBlockAgents: true,
        },
        controller.signal,
      )) {
        events.push(event);
      }
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ name: "AbortError" });
    expect(events.some((event) => event.type === "token")).toBe(true);
    expect(createChatMessage).toHaveBeenCalledTimes(1);
    expect(createChatMessage.mock.calls[0]?.[1]).toMatchObject({ role: "user" });
    expect(createChatMessage.mock.calls.some(([, value]) => value.role === "assistant")).toBe(false);
  });

  it("routes inline thinking tags into message metadata instead of visible content", async () => {
    const { deps, createChatMessage } = generationDepsForChat();
    deps.llm.stream = vi.fn(async function* () {
      yield { type: "token" as const, text: "<thin" };
      yield { type: "token" as const, text: "king>private reasoning</thinking>Visible reply." };
    });

    const events: Array<{ type?: string; data?: unknown }> = [];
    for await (const event of startGeneration(deps, {
      chatId: "chat-1",
      userMessage: "hello",
      impersonateBlockAgents: true,
    })) {
      events.push(event);
    }

    expect(
      events
        .filter((event) => event.type === "token")
        .map((event) => event.data)
        .join(""),
    ).toBe("Visible reply.");
    expect(
      events
        .filter((event) => event.type === "thinking")
        .map((event) => event.data)
        .join(""),
    ).toBe("private reasoning");
    const assistantCreate = createChatMessage.mock.calls.find(
      (call) => (call[1] as { role?: unknown }).role === "assistant",
    );
    expect(assistantCreate?.[1]).toMatchObject({
      content: "Visible reply.",
      extra: { thinking: "private reasoning" },
    });
  });

  it("does not persist a blank assistant message when the provider only returns thinking", async () => {
    const { deps, createChatMessage } = generationDepsForChat();
    deps.llm.stream = vi.fn(async function* () {
      yield { type: "thinking" as const, text: "private reasoning only" };
    });

    await expect(
      drainGeneration(
        startGeneration(deps, {
          chatId: "chat-1",
          userMessage: "hello",
          impersonateBlockAgents: true,
        }),
      ),
    ).rejects.toThrow("Generation produced no visible assistant response");

    expect(createChatMessage.mock.calls.some(([, value]) => value.role === "assistant")).toBe(false);
    expect(createChatMessage.mock.calls.filter(([, value]) => value.role === "user")).toHaveLength(1);
  });

  it("reuses the pre-commit messages and appends the saved user message for normal sends", async () => {
    const { deps, listChatMessages, streamedRequests } = generationDepsForChat();

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "hello",
        impersonateBlockAgents: true,
      }),
    );

    expect(listChatMessages).toHaveBeenCalledTimes(1);
    expect(listChatMessages).toHaveBeenCalledWith("chat-1", undefined);
    expect(streamedRequests).toHaveLength(1);
    expect(streamedRequests[0]).toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "hello" })]),
    });
  });

  it("uses the chat context message limit when assembling roleplay history", async () => {
    const { deps, listChatMessages, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { contextMessageLimit: 1 },
      initialMessages: [{ id: "old-1", chatId: "chat-1", role: "assistant", content: "Old context should stay out." }],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "fresh turn",
        impersonateBlockAgents: true,
      }),
    );

    expect(listChatMessages).toHaveBeenCalledWith("chat-1", { limit: 40 });
    const prompt = JSON.stringify(streamedRequests[0]);
    expect(prompt).toContain("fresh turn");
    expect(prompt).not.toContain("Old context should stay out.");
  });

  it("removes oldest history messages when the prompt exceeds the model context window", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      connectionPatch: {
        defaultParameters: { maxContext: 420, maxTokens: 80 },
      },
      initialMessages: [
        {
          id: "old-1",
          chatId: "chat-1",
          role: "assistant",
          content: `OLD_CONTEXT ${"x".repeat(2400)}`,
        },
        { id: "recent-1", chatId: "chat-1", role: "assistant", content: "Recent context." },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "new turn",
        impersonateBlockAgents: true,
      }),
    );

    const prompt = JSON.stringify(streamedRequests[0]);
    expect(prompt).not.toContain("OLD_CONTEXT");
    expect(prompt).toContain("new turn");
  });

  it("reloads messages after saving when the storage adapter does not return a saved message record", async () => {
    const { deps, listChatMessages, streamedRequests } = generationDepsForChat({
      savedUserMessage: "user-1",
      messagesAfterSave: [
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "What now?" },
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "hello",
        impersonateBlockAgents: true,
      }),
    );

    expect(listChatMessages).toHaveBeenCalledTimes(2);
    expect(streamedRequests).toHaveLength(1);
    expect(streamedRequests[0]).toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "hello" })]),
    });
  });

  it("reloads messages after saving when the saved message record is incomplete", async () => {
    const { deps, listChatMessages, streamedRequests } = generationDepsForChat({
      savedUserMessage: { id: "user-1" },
      messagesAfterSave: [
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "What now?" },
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "hello",
        impersonateBlockAgents: true,
      }),
    );

    expect(listChatMessages).toHaveBeenCalledTimes(2);
    expect(streamedRequests).toHaveLength(1);
    expect(streamedRequests[0]).toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "hello" })]),
    });
  });

  it("passes chat-scoped Claude subscription runtime metadata without changing user parameters", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      connectionPatch: {
        provider: "claude_subscription",
        defaultParameters: {
          temperature: 0.6,
        },
      },
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "continue",
        impersonateBlockAgents: true,
      }),
    );

    expect(streamedRequests[0]).toMatchObject({
      parameters: {
        temperature: 0.6,
        _marinara: {
          chatId: "chat-1",
          mode: "roleplay",
          regenerateMessageId: null,
          impersonate: false,
        },
      },
    });
  });

  it("merges stored chat and game generation parameters into the LLM request", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "game" },
      connectionPatch: {
        defaultParameters: {
          temperature: 0.2,
          maxTokens: 512,
          customParameters: { provider: { seed: 7, base: true } },
        },
      },
      chatMetadata: {
        gameSetupConfig: {
          generationParameters: {
            maxTokens: 1200,
            topP: 0.9,
            customParameters: { provider: { setup: true } },
          },
        },
        gameGenerationParameters: {
          topK: 40,
          customParameters: { provider: { game: true } },
        },
        chatParameters: {
          temperature: 0.7,
          customParameters: { provider: { chat: true } },
        },
      },
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "advance",
        impersonateBlockAgents: true,
        parameters: {
          frequencyPenalty: 0.2,
          customParameters: { provider: { request: true } },
        },
      }),
    );

    expect(streamedRequests[0]).toMatchObject({
      parameters: {
        temperature: 0.7,
        maxTokens: 1200,
        topP: 0.9,
        topK: 40,
        frequencyPenalty: 0.2,
        customParameters: {
          provider: {
            seed: 7,
            base: true,
            setup: true,
            game: true,
            chat: true,
            request: true,
          },
        },
      },
    });
  });

  it("merges selected prompt preset parameters into the LLM request", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", promptPresetId: "preset-1" },
      connectionPatch: {
        defaultParameters: {
          temperature: 0.2,
          maxTokens: 512,
          customParameters: { provider: { connection: true } },
        },
      },
      chatMetadata: {
        chatParameters: {
          maxTokens: 1200,
          customParameters: { provider: { chat: true } },
        },
      },
      prompts: [
        {
          id: "preset-1",
          parameters: {
            temperature: 0.8,
            maxTokens: 900,
            reasoningEffort: "high",
            customParameters: { provider: { preset: true } },
          },
        },
      ],
      promptSections: [
        {
          id: "main",
          presetId: "preset-1",
          name: "Main",
          role: "system",
          content: "Preset rules.",
          enabled: true,
          sortOrder: 0,
        },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "advance",
        impersonateBlockAgents: true,
        parameters: {
          topP: 0.7,
          customParameters: { provider: { request: true } },
        },
      }),
    );

    expect(streamedRequests[0]).toMatchObject({
      parameters: {
        temperature: 0.8,
        maxTokens: 1200,
        topP: 0.7,
        reasoningEffort: "high",
        customParameters: {
          provider: {
            connection: true,
            preset: true,
            chat: true,
            request: true,
          },
        },
      },
    });
  });

  it("uses the same merged parameter sources for assembly formatting and the LLM request", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      connectionPatch: {
        defaultParameters: {
          strictRoleFormatting: false,
        },
      },
      chatMetadata: {
        chatParameters: {
          singleUserMessage: true,
        },
      },
      prompts: [{ id: "preset" }],
      promptSections: [
        {
          id: "main",
          presetId: "preset",
          name: "Main",
          role: "system",
          content: "Rules.",
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "history",
          presetId: "preset",
          name: "History",
          role: "user",
          markerConfig: { type: "chat_history" },
          enabled: true,
          sortOrder: 1,
        },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "advance",
        impersonateBlockAgents: true,
        promptPresetId: "preset",
      }),
    );

    expect(streamedRequests[0]).toMatchObject({
      parameters: {
        strictRoleFormatting: false,
        singleUserMessage: true,
      },
    });
    const messages = (streamedRequests[0] as { messages: Array<{ role: string; content: string }> }).messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "user" });
    expect(messages[0]?.content).toContain("[SYSTEM]");
    expect(messages[0]?.content).toContain("Rules.");
    expect(messages[0]?.content).toContain("[ASSISTANT]");
    expect(messages[0]?.content).toContain("What now?");
    expect(messages[0]?.content).toContain("advance");
  });

  it("stores the exact streamed prompt snapshot on generated assistant messages", async () => {
    const { deps, createChatMessage, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", promptPresetId: "preset-1" },
      prompts: [{ id: "preset-1", wrapFormat: "xml", parameters: { temperature: 0.33, maxTokens: 444 } }],
      promptSections: [
        {
          id: "main",
          presetId: "preset-1",
          name: "Main Prompt",
          role: "system",
          content: "Preset rules.",
          enabled: true,
          sortOrder: 0,
        },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "advance",
        impersonateBlockAgents: true,
      }),
    );

    const request = streamedRequests[0] as {
      messages: Array<{ role: string; content: string }>;
      parameters: Record<string, unknown>;
    };
    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    const extra = (assistantSave?.[1] as { extra?: Record<string, unknown> } | undefined)?.extra ?? {};
    const snapshot = extra.generationPromptSnapshot as {
      messages: Array<{ role: string; content: string }>;
      parameters: Record<string, unknown>;
      promptPresetId?: string | null;
    };

    expect(snapshot.messages).toEqual(JSON.parse(JSON.stringify(request.messages)));
    expect(snapshot.parameters).toEqual(request.parameters);
    expect(snapshot.promptPresetId).toBe("preset-1");
    expect(snapshot.messages.map((message) => message.content).join("\n")).toContain("Preset rules.");
    expect(snapshot.messages.map((message) => message.content).join("\n")).not.toContain("Done.");
    expect(extra.generationPromptSnapshotsBySwipe).toMatchObject({ "0": snapshot });
  });

  it("stores provider-visible parameters in peek prompt snapshots for Opus adaptive models", async () => {
    const { deps, createChatMessage, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", promptPresetId: "preset-1" },
      connectionPatch: { provider: "openrouter", model: "anthropic/claude-opus-4-8" },
      prompts: [
        {
          id: "preset-1",
          wrapFormat: "xml",
          parameters: {
            temperature: 0.33,
            topP: 0.9,
            maxTokens: 444,
            reasoningEffort: "xhigh",
            verbosity: "high",
          },
        },
      ],
      promptSections: [
        {
          id: "main",
          presetId: "preset-1",
          name: "Main Prompt",
          role: "system",
          content: "Preset rules.",
          enabled: true,
          sortOrder: 0,
        },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "advance",
        impersonateBlockAgents: true,
      }),
    );

    const request = streamedRequests[0] as { parameters: Record<string, unknown> };
    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    const extra = (assistantSave?.[1] as { extra?: Record<string, unknown> } | undefined)?.extra ?? {};
    const snapshot = extra.generationPromptSnapshot as {
      parameters: Record<string, unknown>;
      generationInfo?: Record<string, unknown> | null;
    };

    expect(request.parameters).toMatchObject({ temperature: 0.33, topP: 0.9, verbosity: "high" });
    expect(snapshot.parameters).toMatchObject({ stream: true, max_tokens: 444, reasoning: { effort: "high" } });
    expect(snapshot.parameters).not.toHaveProperty("temperature");
    expect(snapshot.parameters).not.toHaveProperty("top_p");
    expect(snapshot.parameters).not.toHaveProperty("verbosity");
    expect(snapshot.generationInfo).toMatchObject({
      temperature: null,
      topP: null,
      verbosity: null,
      maxTokens: 444,
      reasoningEffort: "high",
    });
  });
});

describe("startGeneration chat summary fingerprint metadata", () => {
  it("stores the chat summary fingerprint on generated assistant messages when summary context is injected", async () => {
    const { deps, createChatMessage, streamedRequests } = generationDepsForChat({
      chatMetadata: { summary: "The user met Nia at the market." },
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "hello",
        impersonateBlockAgents: true,
      }),
    );

    expect(
      (streamedRequests[0] as { messages: Array<{ content: string }> }).messages
        .map((message) => message.content)
        .join("\n"),
    ).toContain("The user met Nia at the market.");
    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    expect(assistantSave?.[1]).toMatchObject({
      extra: {
        chatSummaryFingerprint: fingerprintChatSummary("The user met Nia at the market."),
      },
    });
  });

  it("stamps the current summary fingerprint when direct request messages bypass assembled summary context", async () => {
    const { deps, createChatMessage, streamedRequests } = generationDepsForChat({
      chatMetadata: { summary: "This summary should not be injected." },
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        messages: [{ role: "user", content: "Direct prompt" }],
        impersonateBlockAgents: true,
      }),
    );

    expect(
      (streamedRequests[0] as { messages: Array<{ content: string }> }).messages
        .map((message) => message.content)
        .join("\n"),
    ).not.toContain("This summary should not be injected.");
    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    const assistantExtra = (assistantSave?.[1] as { extra?: Record<string, unknown> } | undefined)?.extra ?? {};
    expect(assistantExtra).toMatchObject({
      chatSummaryFingerprint: fingerprintChatSummary("This summary should not be injected."),
    });
  });
});

describe("startGeneration generation replay metadata", () => {
  it("stores impersonate output as a generated user message with replay metadata", async () => {
    const { deps, createChatMessage, streamedRequests } = generationDepsForChat({
      chatPatch: {
        characterIds: ["char-1"],
        personaId: "persona-1",
      },
      characters: [{ id: "char-1", data: { name: "Marina" } }],
      personas: [{ id: "persona-1", name: "Chai" }],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "a tiny answer",
        impersonate: true,
        impersonateBlockAgents: true,
      }),
    );

    const userSave = createChatMessage.mock.calls.find(
      ([, value]) => value.role === "user" && value.content === "Done.",
    );
    expect(userSave?.[1]).toMatchObject({
      role: "user",
      characterId: null,
      content: "Done.",
      extra: {
        generationReplay: {
          impersonate: true,
          userMessage: "a tiny answer",
          impersonateBlockAgents: true,
        },
      },
    });
    expect(createChatMessage.mock.calls.some(([, value]) => value.role === "assistant")).toBe(false);
    const promptText = (streamedRequests[0] as { messages: Array<{ role: string; content: string }> }).messages
      .map((message) => message.content)
      .join("\n");
    expect(promptText).toContain("You are now writing as Chai");
    expect(promptText).toContain("Additional direction for this reply: a tiny answer");
  });

  it("resolves custom impersonate prompt template placeholders before calling the model", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: {
        personaId: "persona-1",
      },
      personas: [{ id: "persona-1", name: "Chai", description: "A brisk captain with clipped wording." }],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "give a direct order",
        impersonate: true,
        impersonateBlockAgents: true,
        impersonatePromptTemplate:
          "Write as {{user}}. Profile: {{persona_description}}. Requested beat: {{impersonate_direction}}",
      }),
    );

    const promptText = (streamedRequests[0] as { messages: Array<{ content: string }> }).messages
      .map((message) => message.content)
      .join("\n");
    expect(promptText).toContain("Write as Chai. Profile: A brisk captain with clipped wording");
    expect(promptText).toContain("Requested beat: give a direct order");
  });

  it("uses a concrete fallback name for impersonation when no persona is selected", async () => {
    const { deps, streamedRequests } = generationDepsForChat();

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "answer with a shrug",
        impersonate: true,
        impersonateBlockAgents: true,
      }),
    );

    const promptText = (streamedRequests[0] as { messages: Array<{ content: string }> }).messages
      .map((message) => message.content)
      .join("\n");
    expect(promptText).toContain("You are now writing as User");
    expect(promptText).not.toContain("{{user}}");
  });

  it("adds swipes when regenerating an impersonated user message", async () => {
    const { deps, createChatMessage, addChatMessageSwipe, patchChatMessageExtra } = generationDepsForChat({
      initialMessages: [
        {
          id: "impersonate-1",
          chatId: "chat-1",
          role: "user",
          content: "Original impersonation.",
          extra: {
            chatSummaryFingerprint: null,
            generationReplay: {
              impersonate: true,
              userMessage: "a tiny answer",
            },
          },
        },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "impersonate-1" }));

    expect(createChatMessage).not.toHaveBeenCalled();
    expect(addChatMessageSwipe).toHaveBeenCalledWith(
      "chat-1",
      "impersonate-1",
      "Done.",
      expect.objectContaining({
        extra: expect.objectContaining({
          generationReplay: {
            impersonate: true,
            userMessage: "a tiny answer",
          },
          generationPromptSnapshot: expect.objectContaining({
            messages: expect.any(Array),
            parameters: expect.any(Object),
          }),
        }),
      }),
    );
    expect(addChatMessageSwipe.mock.calls[0]?.[3]?.activate).toBeUndefined();
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "impersonate-1",
      expect.objectContaining({
        generationReplay: {
          impersonate: true,
          userMessage: "a tiny answer",
        },
        chatSummaryFingerprint: null,
        generationPromptSnapshot: expect.objectContaining({
          messages: expect.any(Array),
          parameters: expect.any(Object),
        }),
        generationPromptSnapshotsBySwipe: expect.objectContaining({
          "1": expect.any(Object),
        }),
      }),
    );
  });

  it("stores guided replay metadata on the generated assistant message", async () => {
    const { deps, createChatMessage } = generationDepsForChat();

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "hello",
        generationGuide: "Keep the reply clipped.",
        generationGuideSource: "guide",
        impersonateBlockAgents: true,
      }),
    );

    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    expect(assistantSave?.[1]).toMatchObject({
      extra: {
        generationReplay: {
          generationGuide: "Keep the reply clipped.",
          generationGuideSource: "guide",
        },
      },
    });
  });

  it("updates the regenerated assistant target with replay metadata for the new active swipe", async () => {
    const { deps, addChatMessageSwipe, patchChatMessageExtra } = generationDepsForChat({
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "first reply", extra: {} },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        regenerateMessageId: "assistant-1",
        generationGuide: "Make this one colder.",
        generationGuideSource: "guide",
      }),
    );

    expect(addChatMessageSwipe).toHaveBeenCalledWith(
      "chat-1",
      "assistant-1",
      "Done.",
      expect.objectContaining({
        extra: expect.objectContaining({
          generationReplay: {
            generationGuide: "Make this one colder.",
            generationGuideSource: "guide",
          },
          generationPromptSnapshot: expect.objectContaining({
            messages: expect.any(Array),
            parameters: expect.any(Object),
          }),
        }),
      }),
    );
    expect(addChatMessageSwipe.mock.calls[0]?.[3]?.activate).toBeUndefined();
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({
        generationReplay: {
          generationGuide: "Make this one colder.",
          generationGuideSource: "guide",
        },
        chatSummaryFingerprint: null,
        generationPromptSnapshot: expect.objectContaining({
          messages: expect.any(Array),
          parameters: expect.any(Object),
        }),
        generationPromptSnapshotsBySwipe: expect.objectContaining({
          "1": expect.any(Object),
        }),
      }),
    );
  });

  it("applies stored assistant replay metadata for direct engine regenerates", async () => {
    const { deps, listChatMessages, streamedRequests } = generationDepsForChat({
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "first reply",
          extra: {
            chatSummaryFingerprint: null,
            generationReplay: {
              generationGuide: "Keep the reply clipped.",
              generationGuideSource: "guide",
            },
          },
        },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect(listChatMessages).toHaveBeenCalledWith("chat-1", undefined);
    expect(streamedRequests[0]).toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "Keep the reply clipped." })]),
    });
  });

  it("skips stored assistant replay metadata when the summary fingerprint is stale", async () => {
    const { deps, patchChatMessageExtra, streamedRequests } = generationDepsForChat({
      chatMetadata: { summary: "Current summary." },
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "first reply",
          extra: {
            chatSummaryFingerprint: fingerprintChatSummary("Old summary."),
            generationReplay: {
              generationGuide: "Keep the reply clipped.",
              generationGuideSource: "guide",
            },
          },
        },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect((streamedRequests[0] as { messages: Array<{ content: string }> }).messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "Keep the reply clipped." })]),
    );
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({
        chatSummaryFingerprint: fingerprintChatSummary("Current summary."),
        generationPromptSnapshot: expect.objectContaining({
          messages: expect.any(Array),
          parameters: expect.any(Object),
        }),
      }),
    );
  });

  it("does not invent replay metadata for plain regenerates without stored replay", async () => {
    const { deps, patchChatMessageExtra, streamedRequests } = generationDepsForChat({
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "first reply", extra: {} },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({
        chatSummaryFingerprint: null,
        generationPromptSnapshot: expect.objectContaining({
          messages: expect.any(Array),
          parameters: expect.any(Object),
        }),
      }),
    );
    expect((streamedRequests[0] as { messages: Array<{ content: string }> }).messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "Keep the reply clipped." })]),
    );
  });

  it("clears stale summary fingerprints on regenerates when the current summary is empty", async () => {
    const { deps, patchChatMessageExtra } = generationDepsForChat({
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "first reply",
          extra: { chatSummaryFingerprint: "stale-fingerprint" },
        },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({
        chatSummaryFingerprint: null,
        generationPromptSnapshot: expect.objectContaining({
          messages: expect.any(Array),
          parameters: expect.any(Object),
        }),
      }),
    );
  });

  it("ignores stored replay metadata from a target outside the active chat", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        {
          id: "assistant-1",
          chatId: "other-chat",
          role: "assistant",
          content: "first reply",
          extra: {
            generationReplay: {
              generationGuide: "Wrong chat guide.",
              generationGuideSource: "guide",
            },
          },
        },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect((streamedRequests[0] as { messages: Array<{ content: string }> }).messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "Wrong chat guide." })]),
    );
  });
});

describe("startGeneration automatic Illustrator cadence", () => {
  it("counts the pending assistant response when enforcing the run interval", async () => {
    const messages = Array.from({ length: 5 }, (_, index) => ({
      id: `assistant-${index + 1}`,
      chatId: "chat-1",
      role: "assistant",
      content: `Assistant message ${index + 1}`,
    }));
    const { deps, streamedRequests } = generationDepsForChat({
      chatMetadata: { enableAgents: true },
      agents: [
        {
          id: "illustrator-agent",
          type: "illustrator",
          name: "Illustrator",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Return JSON.",
          settings: { runInterval: 5 },
        },
      ],
      agentRuns: [
        {
          id: "run-1",
          chatId: "chat-1",
          messageId: "assistant-1",
          agentType: "illustrator",
          resultType: "image_prompt",
          resultData: illustratorDrawData,
          success: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      initialMessages: messages,
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", userMessage: "continue" }));

    expect(streamedRequests).toHaveLength(2);
  });

  it("uses Illustrator image settings and reference images when creating roleplay illustrations", async () => {
    const imageRequests: Record<string, unknown>[] = [];
    const imageGenerate: IntegrationGateway["image"]["generate"] = async <T = unknown>(
      input: Record<string, unknown>,
    ): Promise<T> => {
      imageRequests.push(input);
      return {
        base64: "generated-image",
        mimeType: "image/png",
        provider: "test-image-provider",
        model: "test-image-model",
      } as T;
    };
    const visuals: VisualAssetGateway = {
      listSprites: vi.fn(async (characterId: string) =>
        characterId === "char-dottore"
          ? [
              { expression: "neutral", url: "data:image/png;base64,portrait-sprite" },
              { expression: "full_idle", url: "data:image/png;base64,full-body-sprite" },
            ]
          : [],
      ),
      listBackgrounds: vi.fn(async () => []),
    };
    const illustratorResponse = JSON.stringify({
      shouldGenerate: true,
      reason: "Important visual beat",
      prompt: "Dottore and Mari in a moonlit laboratory confrontation",
      negativePrompt: "low detail",
    });
    const { deps, createChatMessage, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: {
        mode: "roleplay",
        characterIds: ["char-dottore"],
        personaId: "persona-mari",
      },
      chatMetadata: {
        enableAgents: true,
        illustrationResolution: "768x1024",
      },
      characters: [
        {
          id: "char-dottore",
          name: "Il Dottore",
          avatarPath: "data:image/png;base64,dottore-avatar",
          data: {
            name: "Il Dottore",
            appearance: "blue hair, red eyes, white coat, black mask",
          },
        },
      ],
      personas: [
        {
          id: "persona-mari",
          name: "Mari",
          avatarPath: "data:image/png;base64,mari-avatar",
          data: {
            name: "Mari",
            appearance: "brown hair, silver glasses, lab dress",
          },
        },
      ],
      agents: [
        {
          id: "illustrator-agent",
          type: "illustrator",
          name: "Illustrator",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Return JSON.",
          settings: {
            runInterval: 1,
            imageConnectionId: "image-conn",
            imagePositivePrompt: "painterly, dramatic lighting",
            imageNegativePrompt: "bad anatomy",
            useAvatarReferences: true,
          },
        },
      ],
      streamResponses: ["Done.", illustratorResponse],
      integrations: {
        image: { generate: imageGenerate },
      },
      visuals,
    });

    const events = await collectGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "continue",
        imagePromptSettings: { includeAppearances: true },
      }),
    );

    expect(imageRequests).toHaveLength(1);
    const imageRequest = imageRequests[0];
    expect(imageRequest).toMatchObject({
      connectionId: "image-conn",
      kind: "illustration",
      width: 768,
      height: 1024,
      negativePrompt: "low detail, bad anatomy",
      referenceImages: ["data:image/png;base64,full-body-sprite", "data:image/png;base64,mari-avatar"],
    });
    expect(String(imageRequest.prompt)).toContain("Dottore and Mari");
    expect(String(imageRequest.prompt)).toContain("Il Dottore: blue hair");
    expect(String(imageRequest.prompt)).toContain("Mari: brown hair");
    expect(String(imageRequest.prompt)).toContain("painterly");

    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    expect((assistantSave?.[1] as { extra?: { attachments?: unknown[] } } | undefined)?.extra?.attachments).toBe(
      undefined,
    );
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-2",
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            type: "image",
            url: "data:image/png;base64,generated-image",
            galleryId: "gallery-1",
            prompt: imageRequest.prompt,
          }),
        ],
      }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "illustration",
          data: expect.objectContaining({ galleryId: "gallery-1", prompt: imageRequest.prompt }),
        }),
      ]),
    );
    expect(deps.storage.create).toHaveBeenCalledWith(
      "gallery",
      expect.objectContaining({
        chatId: "chat-1",
        kind: "illustration",
        prompt: imageRequest.prompt,
        referenceImageCount: 2,
      }),
    );
  });
});

describe("startGeneration automatic custom agent cadence", () => {
  it("checks custom cadence against the full timeline during regenerations", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatMetadata: { enableAgents: true },
      agents: [
        {
          id: "custom-agent",
          type: "custom-scene-scout",
          name: "Scene Scout",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Watch for scene keywords.",
          settings: { resultType: "context_injection", runInterval: 5 },
        },
      ],
      agentRuns: [
        {
          id: "run-1",
          chatId: "chat-1",
          messageId: "assistant-1",
          agentType: "custom-scene-scout",
          resultType: "context_injection",
          resultData: { text: "old note" },
          success: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "first reply", extra: {} },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect(streamedRequests).toHaveLength(1);
  });
});

describe("startGeneration agent runtime parity", () => {
  it("pauses for writer agent review when chat metadata requests it", async () => {
    const { deps, streamedRequests, createChatMessage } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true, activeAgentIds: ["agent-a"], reviewWriterAgentOutputs: true },
      agents: [
        {
          id: "agent-a",
          type: "prose-guardian",
          name: "Prose Guardian",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Add a concise style note.",
        },
      ],
    });

    const events = await collectGeneration(startGeneration(deps, { chatId: "chat-1", userMessage: "hello" }));

    expect(streamedRequests).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "agent_injection_review",
        data: expect.objectContaining({
          chatId: "chat-1",
          injections: [
            expect.objectContaining({
              agentType: "prose-guardian",
              agentName: "Prose Guardian",
              text: "Done.",
            }),
          ],
        }),
      }),
    );
    expect(createChatMessage).not.toHaveBeenCalledWith("chat-1", expect.objectContaining({ role: "assistant" }));
  });

  it("uses reviewed writer agent overrides when continuing after review", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", promptPresetId: "preset-1" },
      chatMetadata: { enableAgents: true, activeAgentIds: ["agent-a"], reviewWriterAgentOutputs: true },
      initialMessages: [{ id: "user-1", chatId: "chat-1", role: "user", content: "hello" }],
      agents: [
        {
          id: "agent-a",
          type: "prose-guardian",
          name: "Prose Guardian",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Add a concise style note.",
        },
      ],
      prompts: [{ id: "preset-1", parameters: {} }],
      promptSections: [
        {
          id: "main",
          presetId: "preset-1",
          name: "Main",
          role: "system",
          content: "Main prompt.",
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "agent-data",
          presetId: "preset-1",
          name: "Agent Data",
          role: "system",
          enabled: true,
          markerConfig: { type: "agent_data", agentType: "prose-guardian" },
          sortOrder: 1,
        },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        agentInjectionOverrides: [
          {
            agentType: "prose-guardian",
            agentName: "Prose Guardian",
            text: "Edited writer guidance.",
          },
        ],
      }),
    );

    expect(streamedRequests).toHaveLength(1);
    const mainRequest = streamedRequests[0] as { messages: Array<{ content: string }> };
    const mainPrompt = mainRequest.messages.map((message) => message.content).join("\n\n");
    expect(mainPrompt).toContain("Main prompt.");
    expect(mainPrompt).toContain("Edited writer guidance.");
  });

  it("injects pre-generation agent data into preset agent_data markers before the main call", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", promptPresetId: "preset-1" },
      chatMetadata: { enableAgents: true, activeAgentIds: ["agent-a"] },
      agents: [
        {
          id: "agent-a",
          type: "prose-guardian",
          name: "Prose Guardian",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Add a concise style note.",
        },
      ],
      prompts: [{ id: "preset-1", parameters: {} }],
      promptSections: [
        {
          id: "main",
          presetId: "preset-1",
          name: "Main",
          role: "system",
          content: "Main prompt.",
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "agent-data",
          presetId: "preset-1",
          name: "Agent Data",
          role: "system",
          enabled: true,
          markerConfig: { type: "agent_data", agentType: "prose-guardian" },
          sortOrder: 1,
        },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", userMessage: "hello" }));

    expect(streamedRequests).toHaveLength(2);
    const mainRequest = streamedRequests[1] as { messages: Array<{ content: string }> };
    const mainPrompt = mainRequest.messages.map((message) => message.content).join("\n\n");
    expect(mainPrompt).toContain("Main prompt.");
    expect(mainPrompt).toContain("Done.");
  });

  it("persists secret plot agent output into agent memory", async () => {
    const plotData = {
      overarchingArc: { description: "Recover the anchor", completed: false },
      sceneDirections: [
        { direction: "Send a coded invitation", fulfilled: false },
        { direction: "Retire the decoy", fulfilled: true },
      ],
      pacing: "mounting-pressure",
      staleDetected: true,
    };
    let turn = 0;
    const stream: LlmGateway["stream"] = vi.fn(async function* () {
      if (turn === 0) {
        turn += 1;
        yield { type: "token" as const, text: JSON.stringify(plotData) };
        return;
      }
      turn += 1;
      yield { type: "token" as const, text: "Main response." };
    });
    const { deps } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true, activeAgentIds: ["secret-agent"] },
      agents: [
        {
          id: "secret-agent",
          type: "secret-plot-driver",
          name: "Secret Plot Driver",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Plan the hidden arc.",
        },
      ],
    });
    deps.llm = { ...deps.llm, stream };

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", userMessage: "hello" }));

    const createMock = deps.storage.create as unknown as {
      mock: { calls: Array<[string, Record<string, unknown>]> };
    };
    const memoryWrites = createMock.mock.calls
      .filter(([entity]) => entity === "agent-memory")
      .map(([, value]) => value);
    const memoryByKey = new Map(memoryWrites.map((value) => [String(value.key), value]));

    expect(JSON.parse(String(memoryByKey.get("overarchingArc")?.value))).toEqual(plotData.overarchingArc);
    expect(JSON.parse(String(memoryByKey.get("sceneDirections")?.value))).toEqual([
      { direction: "Send a coded invitation", fulfilled: false },
    ]);
    expect(JSON.parse(String(memoryByKey.get("recentlyFulfilled")?.value))).toEqual(["Retire the decoy"]);
    expect(memoryByKey.get("pacing")?.value).toBe("mounting-pressure");
    expect(JSON.parse(String(memoryByKey.get("staleDetected")?.value))).toBe(true);
  });

  it("does not duplicate parallel agent results from callback and return paths", async () => {
    const events: unknown[] = [];
    const { deps } = generationDepsForChat({
      chatMetadata: { enableAgents: true },
      agents: [
        {
          id: "agent-a",
          type: "custom-scene-scout",
          name: "Scene Scout",
          enabled: true,
          phase: "parallel",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Watch the scene.",
          settings: { resultType: "context_injection" },
        },
      ],
    });

    for await (const event of startGeneration(deps, { chatId: "chat-1", userMessage: "hello" })) {
      events.push(event);
    }

    const agentEvents = events.filter((event) => (event as { type?: string }).type === "agent_result");
    expect(agentEvents).toHaveLength(1);
    expect(deps.storage.create).toHaveBeenCalledWith(
      "agent-runs",
      expect.objectContaining({
        agentConfigId: "agent-a",
        agentId: "agent-a",
        agentType: "custom-scene-scout",
        agentName: "Scene Scout",
      }),
    );
  });

  it("stores expression agent choices on generated assistant message metadata", async () => {
    const { deps, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: { mode: "roleplay", characterIds: ["char-dottore"] },
      chatMetadata: { enableAgents: true },
      characters: [{ id: "char-dottore", data: { name: "Dottore", description: "Fatui scientist." } }],
      agents: [
        {
          id: "expression",
          type: "expression",
          name: "Expression Engine",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Pick the visible character expression.",
          settings: {},
        },
      ],
    });
    let turn = 0;
    const stream: LlmGateway["stream"] = vi.fn(async function* () {
      if (turn === 0) {
        turn += 1;
        yield { type: "token" as const, text: "Assistant reply." };
        return;
      }
      turn += 1;
      yield {
        type: "token" as const,
        text: [
          '<result agent="expression">',
          '{ "expressions": [{ "characterId": "char-dottore", "characterName": "Dottore", "expression": "smirk", "transition": "crossfade" }] }',
          "</result>",
        ].join("\n"),
      };
    });
    deps.llm = { ...deps.llm, stream };

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", userMessage: "hello" }));

    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-2",
      expect.objectContaining({
        spriteExpressions: {
          "char-dottore": "smirk",
          Dottore: "smirk",
        },
      }),
    );
  });

  it("saves the assistant message before waiting for post-processing agents", async () => {
    const { deps, createChatMessage, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true },
      agents: [
        {
          id: "cyoa",
          type: "cyoa",
          name: "CYOA Choices",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Offer choices.",
          settings: {},
        },
      ],
    });
    const callOrder: string[] = [];
    let turn = 0;
    deps.llm = {
      ...deps.llm,
      stream: vi.fn(async function* () {
        if (turn === 0) {
          turn += 1;
          yield { type: "token" as const, text: "Assistant reply." };
          return;
        }
        callOrder.push("post-agent-started");
        turn += 1;
        yield { type: "token" as const, text: JSON.stringify({ choices: [{ label: "Look", text: "I look." }] }) };
      }),
    };
    createChatMessage.mockImplementation(async (_chatId: string, value: Record<string, unknown>) => {
      callOrder.push(`save-${String(value.role)}`);
      return { id: value.role === "assistant" ? "assistant-2" : "user-1", chatId: "chat-1", ...value };
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", userMessage: "hello" }));

    expect(callOrder).toEqual(["save-user", "save-assistant", "post-agent-started"]);
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-2",
      expect.objectContaining({
        cyoaChoices: [{ label: "Look", text: "I look." }],
      }),
    );
  });

  it("persists CYOA choices and pre-generation injections on generated assistant message metadata", async () => {
    const { deps, createChatMessage, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true },
      agents: [
        {
          id: "prose-guardian",
          type: "prose-guardian",
          name: "Prose Guardian",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Give writing guidance.",
          settings: {},
        },
        {
          id: "cyoa",
          type: "cyoa",
          name: "CYOA Choices",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Offer choices.",
          settings: {},
        },
      ],
    });
    const responses = [
      "Vary sentence rhythm.",
      "Assistant reply.",
      JSON.stringify({
        choices: [
          { label: "Press forward", text: "I step closer and press for the truth." },
          { label: "Hold back", text: "I stay quiet and watch for another clue." },
        ],
      }),
    ];
    let turn = 0;
    deps.llm = {
      ...deps.llm,
      stream: vi.fn(async function* () {
        yield { type: "token" as const, text: responses[turn++] ?? "" };
      }),
    };

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", userMessage: "hello" }));

    const assistantCreate = createChatMessage.mock.calls.find(
      (call) => (call[1] as { role?: unknown }).role === "assistant",
    );
    expect(assistantCreate?.[1]).toMatchObject({
      extra: {
        contextInjections: [
          { agentType: "prose-guardian", agentName: "Prose Guardian", text: "Vary sentence rhythm." },
        ],
      },
    });
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-2",
      expect.objectContaining({
        contextInjections: [
          { agentType: "prose-guardian", agentName: "Prose Guardian", text: "Vary sentence rhythm." },
        ],
        cyoaChoices: [
          { label: "Press forward", text: "I step closer and press for the truth." },
          { label: "Hold back", text: "I stay quiet and watch for another clue." },
        ],
      }),
    );
  });

  it("stores regenerated CYOA choices and injections on the new assistant swipe", async () => {
    const { deps, addChatMessageSwipe, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true },
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "first reply", extra: {} },
      ],
      agents: [
        {
          id: "prose-guardian",
          type: "prose-guardian",
          name: "Prose Guardian",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Give writing guidance.",
          settings: {},
        },
        {
          id: "cyoa",
          type: "cyoa",
          name: "CYOA Choices",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Offer choices.",
          settings: {},
        },
      ],
    });
    const responses = [
      "Make the next swipe sharper.",
      "Regenerated reply.",
      JSON.stringify({ choices: [{ label: "Demand answers", text: "I demand answers immediately." }] }),
    ];
    let turn = 0;
    deps.llm = {
      ...deps.llm,
      stream: vi.fn(async function* () {
        yield { type: "token" as const, text: responses[turn++] ?? "" };
      }),
    };

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect(addChatMessageSwipe).toHaveBeenCalledWith(
      "chat-1",
      "assistant-1",
      "Regenerated reply.",
      expect.objectContaining({
        extra: expect.objectContaining({
          contextInjections: [
            { agentType: "prose-guardian", agentName: "Prose Guardian", text: "Make the next swipe sharper." },
          ],
        }),
      }),
    );
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({
        contextInjections: [
          { agentType: "prose-guardian", agentName: "Prose Guardian", text: "Make the next swipe sharper." },
        ],
        cyoaChoices: [{ label: "Demand answers", text: "I demand answers immediately." }],
      }),
    );
  });

  it("persists targeted CYOA and context-injection retries to the target assistant message", async () => {
    const { deps, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true },
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "first reply",
          extra: {
            contextInjections: [
              { agentType: "prose-guardian", agentName: "Prose Guardian", text: "Old guidance." },
              { agentType: "director", agentName: "Narrative Director", text: "Preserve this beat." },
            ],
            cyoaChoices: [{ label: "Old", text: "Old choice." }],
          },
        },
      ],
      agents: [
        {
          id: "prose-guardian",
          type: "prose-guardian",
          name: "Prose Guardian",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Give writing guidance.",
          settings: {},
        },
        {
          id: "cyoa",
          type: "cyoa",
          name: "CYOA Choices",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Offer choices.",
          settings: {},
        },
      ],
    });
    const responses = [
      "Fresh guidance.",
      JSON.stringify({ choices: [{ label: "Investigate", text: "I investigate the strange sound." }] }),
    ];
    let turn = 0;
    deps.llm = {
      ...deps.llm,
      stream: vi.fn(async function* () {
        yield { type: "token" as const, text: responses[turn++] ?? "" };
      }),
    };

    await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["prose-guardian", "cyoa"],
      options: { forMessageId: "assistant-1" },
    });

    expect(patchChatMessageExtra).toHaveBeenCalledWith("assistant-1", {
      contextInjections: [
        { agentType: "prose-guardian", agentName: "Prose Guardian", text: "Fresh guidance." },
        { agentType: "director", agentName: "Narrative Director", text: "Preserve this beat." },
      ],
      cyoaChoices: [{ label: "Investigate", text: "I investigate the strange sound." }],
    });
  });
});

describe("startGeneration Discord mirror", () => {
  it("mirrors saved user and assistant messages when a chat has a Discord webhook", async () => {
    const mirrorMessage = mockDiscordMirror();
    const webhookUrl = "https://discord.com/api/webhooks/123456789/test-token";
    const { deps } = generationDepsForChat({
      chatPatch: { characterIds: ["char-1"], personaId: "persona-1" },
      chatMetadata: { discordWebhookUrl: webhookUrl },
      characters: [{ id: "char-1", data: { name: "Marina" } }],
      personas: [{ id: "persona-1", name: "Natalie" }],
    });
    deps.integrations = {
      ...deps.integrations,
      discord: { mirrorMessage: mirrorMessage as DiscordGateway["mirrorMessage"] },
    };

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "hello",
        impersonateBlockAgents: true,
      }),
    );

    expect(mirrorMessage).toHaveBeenCalledTimes(2);
    expect(mirrorMessage).toHaveBeenNthCalledWith(1, {
      webhookUrl,
      content: "hello",
      username: "Natalie",
    });
    expect(mirrorMessage).toHaveBeenNthCalledWith(2, {
      webhookUrl,
      content: "Done.",
      username: "Marina",
    });
  });

  it("does not mirror regenerations", async () => {
    const mirrorMessage = mockDiscordMirror();
    const { deps } = generationDepsForChat({
      chatMetadata: { discordWebhookUrl: "https://discord.com/api/webhooks/123456789/test-token" },
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "first reply", extra: {} },
      ],
    });
    deps.integrations = {
      ...deps.integrations,
      discord: { mirrorMessage: mirrorMessage as DiscordGateway["mirrorMessage"] },
    };

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect(mirrorMessage).not.toHaveBeenCalled();
  });
});

describe("startGeneration group turn prompt toggle", () => {
  it("keeps target character instructions enabled by default for individual roleplay groups", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", characterIds: ["char-1", "char-2"] },
      chatMetadata: { groupChatMode: "individual" },
      characters: [
        { id: "char-1", data: { name: "Marina" } },
        { id: "char-2", data: { name: "Roux" } },
      ],
    });

    await drainGeneration(
      startGeneration(deps, { chatId: "chat-1", forCharacterId: "char-1", impersonateBlockAgents: true }),
    );

    expect((streamedRequests[0] as { messages: Array<{ content: string }> }).messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("Respond only as Marina") })]),
    );
  });

  it("omits target character instructions when individual roleplay group turn prompts are disabled", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", characterIds: ["char-1", "char-2"] },
      chatMetadata: { groupChatMode: "individual", groupTurnPromptEnabled: false },
      characters: [
        { id: "char-1", data: { name: "Marina" } },
        { id: "char-2", data: { name: "Roux" } },
      ],
    });

    await drainGeneration(
      startGeneration(deps, { chatId: "chat-1", forCharacterId: "char-1", impersonateBlockAgents: true }),
    );

    expect((streamedRequests[0] as { messages: Array<{ content: string }> }).messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("Respond only as Marina") })]),
    );
  });

  it("resolves sequential individual roleplay turns before assembling character cards", async () => {
    const { deps, createChatMessage, streamedRequests } = generationDepsForChat({
      chatPatch: {
        mode: "roleplay",
        promptPresetId: "preset",
        characterIds: ["char-a", "char-b"],
      },
      chatMetadata: { groupChatMode: "individual", groupResponseOrder: "sequential" },
      characters: [
        { id: "char-a", data: { name: "Aster", description: "ASTER CARD" } },
        { id: "char-b", data: { name: "Briar", description: "BRIAR CARD" } },
      ],
      prompts: [{ id: "preset", wrapFormat: "xml" }],
      promptSections: [
        {
          id: "character",
          presetId: "preset",
          name: "Characters",
          role: "system",
          markerConfig: { type: "character" },
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "history",
          presetId: "preset",
          name: "History",
          role: "user",
          markerConfig: { type: "chat_history" },
          enabled: true,
          sortOrder: 1,
        },
      ],
      initialMessages: [
        {
          id: "assistant-a",
          chatId: "chat-1",
          role: "assistant",
          characterId: "char-a",
          content: "Aster answered last.",
        },
      ],
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "continue",
        impersonateBlockAgents: true,
      }),
    );

    const promptText = (streamedRequests[0] as { messages: Array<{ content: string }> }).messages
      .map((message) => message.content)
      .join("\n");
    expect(promptText).toContain("BRIAR CARD");
    expect(promptText).not.toContain("ASTER CARD");
    expect(promptText).toContain("Respond only as Briar");
    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    expect(assistantSave?.[1]).toMatchObject({ characterId: "char-b" });
  });

  it("uses the smart response orchestrator to choose one individual roleplay responder", async () => {
    const { deps, createChatMessage, streamedRequests, completedRequests } = generationDepsForChat({
      chatPatch: {
        mode: "roleplay",
        promptPresetId: "preset",
        characterIds: ["char-a", "char-b"],
      },
      chatMetadata: { groupChatMode: "individual", groupResponseOrder: "smart" },
      characters: [
        { id: "char-a", data: { name: "Aster", description: "ASTER CARD", personality: "Reserved." } },
        { id: "char-b", data: { name: "Briar", description: "BRIAR CARD", personality: "Direct." } },
      ],
      prompts: [{ id: "preset", wrapFormat: "xml" }],
      promptSections: [
        {
          id: "character",
          presetId: "preset",
          name: "Characters",
          role: "system",
          markerConfig: { type: "character" },
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "history",
          presetId: "preset",
          name: "History",
          role: "user",
          markerConfig: { type: "chat_history" },
          enabled: true,
          sortOrder: 1,
        },
      ],
      initialMessages: [{ id: "user-old", chatId: "chat-1", role: "user", content: "Who should answer?" }],
      completeResponse: '{"characterIds":["char-b"],"reason":"Briar was addressed."}',
    });

    await drainGeneration(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "Briar, what do you think?",
        impersonateBlockAgents: true,
      }),
    );

    expect(completedRequests).toHaveLength(1);
    const selectorPrompt = JSON.stringify(completedRequests[0]);
    expect(selectorPrompt).toContain("hidden response orchestrator");
    expect(selectorPrompt).toContain("char-b");
    const promptText = (streamedRequests[0] as { messages: Array<{ content: string }> }).messages
      .map((message) => message.content)
      .join("\n");
    expect(promptText).toContain("BRIAR CARD");
    expect(promptText).not.toContain("ASTER CARD");
    const assistantSave = createChatMessage.mock.calls.find(([, value]) => value.role === "assistant");
    expect(assistantSave?.[1]).toMatchObject({ characterId: "char-b" });
  });
});

describe("retryGenerationAgents lorebook keeper backfill", () => {
  it("uses run interval and read-behind settings to backfill only unprocessed batch anchors", async () => {
    const messages = Array.from({ length: 40 }, (_, index) => ({
      id: `assistant-${index + 1}`,
      chatId: "chat-1",
      role: "assistant",
      content: `Assistant message ${index + 1}`,
    }));
    const { deps, streamedRequests } = generationDepsForChat({
      chatMetadata: {
        enableAgents: true,
        activeAgentIds: ["lorebook-keeper"],
        lorebookKeeperReadBehindMessages: 10,
      },
      agents: [
        {
          id: "lorebook-agent",
          type: "lorebook-keeper",
          name: "Lorebook Keeper",
          enabled: true,
          phase: "post_processing",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Return JSON.",
          settings: { runInterval: 10, contextSize: 15 },
        },
      ],
      agentRuns: [
        {
          id: "run-10",
          chatId: "chat-1",
          messageId: "assistant-10",
          agentType: "lorebook-keeper",
          success: true,
        },
      ],
      initialMessages: messages,
    });

    const { results } = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["lorebook-keeper"],
      options: { lorebookKeeperBackfill: true },
    });

    expect(results).toHaveLength(2);
    expect(streamedRequests).toHaveLength(2);
    expect(
      streamedRequests.map((request) => (request as { messages: Array<{ content: string }> }).messages.at(-1)?.content),
    ).toEqual([expect.stringContaining("Assistant message 20"), expect.stringContaining("Assistant message 30")]);
    const promptTexts = streamedRequests.map((request) =>
      (request as { messages: Array<{ content: string }> }).messages.map((message) => message.content).join("\n"),
    );
    expect(promptTexts[0]).toContain("Assistant message 19");
    expect(promptTexts[0]).toContain("Assistant message 20");
    expect(promptTexts[0]).not.toContain("Assistant message 31");
    expect(promptTexts[1]).toContain("Assistant message 29");
    expect(promptTexts[1]).toContain("Assistant message 30");
    expect(promptTexts[1]).not.toContain("Assistant message 31");
  });
});

describe("retryGenerationAgents custom agent activation", () => {
  const keywordGatedCustomAgent = {
    id: "custom-agent",
    type: "custom-scene-scout",
    name: "Scene Scout",
    enabled: true,
    phase: "pre_generation",
    connectionId: null,
    model: "agent-model",
    promptTemplate: "Watch for scene keywords.",
    settings: {
      resultType: "context_injection",
      activationKeywords: ["secret"],
      activationScanDepth: 1,
    },
  };

  it("respects activation keywords by default", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      agents: [keywordGatedCustomAgent],
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "The secret door glows." },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "The room is quiet." },
        { id: "user-2", chatId: "chat-1", role: "user", content: "We wait in silence." },
        { id: "assistant-2", chatId: "chat-1", role: "assistant", content: "Nothing changes." },
      ],
    });

    const { results } = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["custom-scene-scout"],
    });

    expect(results).toEqual([]);
    expect(streamedRequests).toHaveLength(0);
  });

  it("bypasses activation keywords only when retry options request it", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      agents: [keywordGatedCustomAgent],
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "The secret door glows." },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "The room is quiet." },
        { id: "user-2", chatId: "chat-1", role: "user", content: "We wait in silence." },
        { id: "assistant-2", chatId: "chat-1", role: "assistant", content: "Nothing changes." },
      ],
    });

    const { results } = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["custom-scene-scout"],
      options: { bypassActivation: true },
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      agentId: "custom-agent",
      agentType: "custom-scene-scout",
      success: true,
    });
    expect(streamedRequests).toHaveLength(1);
  });
});

describe("retryGenerationAgents illustrator", () => {
  const illustratorAgent = (settings: Record<string, unknown>) => ({
    id: "illustrator-agent",
    type: "illustrator",
    name: "Illustrator",
    enabled: true,
    phase: "post_processing",
    connectionId: null,
    model: "agent-model",
    promptTemplate: "Return JSON.",
    settings: { runInterval: 1, ...settings },
  });

  const illustratorResponse = JSON.stringify({
    shouldGenerate: true,
    reason: "Manual illustrate marker",
    prompt: "A11_MANUAL_ILLUSTRATE_PROMPT_MARKER",
  });

  it("generates an illustration and emits an illustration event when an image connection is configured", async () => {
    const imageRequests: Record<string, unknown>[] = [];
    const imageGenerate: IntegrationGateway["image"]["generate"] = async <T = unknown>(
      input: Record<string, unknown>,
    ): Promise<T> => {
      imageRequests.push(input);
      return {
        base64: "generated-image",
        mimeType: "image/png",
        provider: "test-image-provider",
        model: "test-image-model",
      } as T;
    };
    const { deps, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true },
      agents: [illustratorAgent({ imageConnectionId: "image-conn" })],
      streamResponses: [illustratorResponse],
      integrations: { image: { generate: imageGenerate } },
    });

    const { results, events } = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["illustrator"],
      options: { bypassActivation: true, forMessageId: "assistant-1" },
    });

    expect(imageRequests).toHaveLength(1);
    expect(results.some((result) => result.agentType === "illustrator" && result.type === "image_prompt")).toBe(true);
    expect(deps.storage.create).toHaveBeenCalledWith(
      "gallery",
      expect.objectContaining({ chatId: "chat-1", kind: "illustration" }),
    );
    expect(patchChatMessageExtra).toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({
        attachments: [expect.objectContaining({ type: "image", galleryId: "gallery-1" })],
      }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "illustration", data: expect.objectContaining({ galleryId: "gallery-1" }) }),
      ]),
    );
  });

  it("generates an illustration via the latest-assistant fallback when no forMessageId is passed", async () => {
    // The real Illustrate button calls retryAgents(chatId, ["illustrator"]) with
    // no options, so the target resolves via targetAssistantMessage's
    // latest-assistant branch rather than forMessageId.
    const imageRequests: Record<string, unknown>[] = [];
    const imageGenerate: IntegrationGateway["image"]["generate"] = async <T = unknown>(
      input: Record<string, unknown>,
    ): Promise<T> => {
      imageRequests.push(input);
      return {
        base64: "generated-image",
        mimeType: "image/png",
        provider: "test-image-provider",
        model: "test-image-model",
      } as T;
    };
    const { deps } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true },
      agents: [illustratorAgent({ imageConnectionId: "image-conn" })],
      streamResponses: [illustratorResponse],
      integrations: { image: { generate: imageGenerate } },
    });

    const { events } = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["illustrator"],
      options: { bypassActivation: true },
    });

    expect(imageRequests).toHaveLength(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "illustration", data: expect.objectContaining({ galleryId: "gallery-1" }) }),
      ]),
    );
  });

  it("emits an illustration_error and creates no gallery image when no image connection is configured", async () => {
    const imageGenerate = vi.fn();
    const { deps, patchChatMessageExtra } = generationDepsForChat({
      chatPatch: { mode: "roleplay" },
      chatMetadata: { enableAgents: true },
      agents: [illustratorAgent({})],
      streamResponses: [illustratorResponse],
      integrations: { image: { generate: imageGenerate as unknown as IntegrationGateway["image"]["generate"] } },
    });

    const { events } = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["illustrator"],
      options: { bypassActivation: true, forMessageId: "assistant-1" },
    });

    expect(imageGenerate).not.toHaveBeenCalled();
    expect(deps.storage.create).not.toHaveBeenCalledWith("gallery", expect.anything());
    expect(patchChatMessageExtra).not.toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({ attachments: expect.anything() }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "illustration_error",
          data: expect.objectContaining({
            error: "No image generation connection configured for the Illustrator agent.",
          }),
        }),
      ]),
    );
  });

  it("returns the agent result with no illustration events for a non-illustrator retry", async () => {
    const { deps } = generationDepsForChat({
      chatMetadata: { enableAgents: true },
      agents: [
        {
          id: "scene-scout",
          type: "custom-scene-scout",
          name: "Scene Scout",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Watch the scene.",
          settings: { resultType: "context_injection" },
        },
      ],
      streamResponses: ["Scene note."],
    });

    const { results, events } = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["custom-scene-scout"],
      options: { bypassActivation: true, forMessageId: "assistant-1" },
    });

    expect(results.some((result) => result.agentType === "custom-scene-scout")).toBe(true);
    expect(events).toEqual([]);
  });
});
