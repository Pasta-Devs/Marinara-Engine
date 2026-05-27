import { describe, expect, it, vi } from "vitest";
import type { DiscordGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
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

function generationDepsForChat(options: {
  savedUserMessage?: unknown;
  messagesAfterSave?: Record<string, unknown>[];
  chatPatch?: Record<string, unknown>;
  chatMetadata?: Record<string, unknown>;
  characters?: Record<string, unknown>[];
  personas?: Record<string, unknown>[];
  agents?: Record<string, unknown>[];
  agentRuns?: Record<string, unknown>[];
  initialMessages?: Record<string, unknown>[];
} = {}) {
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
  };
  const initialMessages = options.initialMessages ?? [
    { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "What now?" },
  ];
  const messagesById = new Map(initialMessages.map((message) => [String(message.id), message]));
  const listChatMessages = vi.fn(async () =>
    listChatMessages.mock.calls.length > 1 && options.messagesAfterSave
      ? options.messagesAfterSave
      : initialMessages,
  );
  const streamedRequests: unknown[] = [];
  const stream: LlmGateway["stream"] = vi.fn(async function* (request) {
    streamedRequests.push(request);
    yield { type: "token" as const, text: "Done." };
  });
  const createChatMessage = vi.fn(async (_chatId: string, value: Record<string, unknown>) => {
    if (value.role === "user") {
      return options.savedUserMessage ?? { id: "user-1", chatId: "chat-1", ...value };
    }
    return { id: "assistant-2", chatId: "chat-1", ...value };
  });
  const addChatMessageSwipe = vi.fn(async (_chatId: string, messageId: string, content: string) => ({
    ...messagesById.get(messageId),
    content,
    activeSwipeIndex: 1,
    swipeCount: 2,
  }));
  const patchChatMessageExtra = vi.fn(async (messageId: string, patch: Record<string, unknown>) => ({
    ...messagesById.get(messageId),
    extra: {
      ...((messagesById.get(messageId)?.extra as Record<string, unknown> | undefined) ?? {}),
      ...patch,
    },
  }));
  const storage = {
    get: vi.fn(async (entity: string, id: string) => {
      if (entity === "chats" && id === "chat-1") return chat;
      if (entity === "connections" && id === "connection-1") return connection;
      if (entity === "characters") return options.characters?.find((character) => character.id === id) ?? null;
      if (entity === "personas") return options.personas?.find((persona) => persona.id === id) ?? null;
      if (entity === "messages") return messagesById.get(id) ?? null;
      return null;
    }),
    list: vi.fn(async (entity: string) => {
      if (entity === "personas") return options.personas ?? [];
      if (entity === "agents") return options.agents ?? [];
      if (entity === "agent-runs") return options.agentRuns ?? [];
      return [];
    }),
    create: vi.fn(async (_entity: string, value: Record<string, unknown>) => value),
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
    llm: { stream } as Partial<LlmGateway> as LlmGateway,
    integrations: {} as GenerationEngineDeps["integrations"],
  };
  return { deps, createChatMessage, addChatMessageSwipe, patchChatMessageExtra, listChatMessages, streamedRequests };
}

async function drainGeneration(stream: AsyncGenerator<unknown>) {
  for await (const _event of stream) {
    // Exhaust the generator so storage and LLM calls finish.
  }
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
    expect(streamedRequests).toHaveLength(1);
    expect(streamedRequests[0]).toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "hello" })]),
    });
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

    expect(addChatMessageSwipe).toHaveBeenCalledWith("chat-1", "assistant-1", "Done.");
    expect(patchChatMessageExtra).toHaveBeenCalledWith("assistant-1", {
      generationReplay: {
        generationGuide: "Make this one colder.",
        generationGuideSource: "guide",
      },
      chatSummaryFingerprint: null,
    });
  });

  it("applies stored assistant replay metadata for direct engine regenerates", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
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

    expect(streamedRequests[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "Keep the reply clipped." }),
      ]),
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
    expect(patchChatMessageExtra).toHaveBeenCalledWith("assistant-1", {
      chatSummaryFingerprint: fingerprintChatSummary("Current summary."),
    });
  });

  it("does not invent replay metadata for plain regenerates without stored replay", async () => {
    const { deps, patchChatMessageExtra, streamedRequests } = generationDepsForChat({
      initialMessages: [
        { id: "user-1", chatId: "chat-1", role: "user", content: "hello" },
        { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "first reply", extra: {} },
      ],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", regenerateMessageId: "assistant-1" }));

    expect(patchChatMessageExtra).toHaveBeenCalledWith("assistant-1", { chatSummaryFingerprint: null });
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

    expect(patchChatMessageExtra).toHaveBeenCalledWith("assistant-1", { chatSummaryFingerprint: null });
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
  it("keeps target character instructions enabled by default for non-conversation group chats", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", characterIds: ["char-1", "char-2"] },
      characters: [{ id: "char-1", data: { name: "Marina" } }],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", forCharacterId: "char-1", impersonateBlockAgents: true }));

    expect((streamedRequests[0] as { messages: Array<{ content: string }> }).messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "[Generation instruction: respond as Marina.]" })]),
    );
  });

  it("omits target character instructions when non-conversation group turn prompts are disabled", async () => {
    const { deps, streamedRequests } = generationDepsForChat({
      chatPatch: { mode: "roleplay", characterIds: ["char-1", "char-2"] },
      chatMetadata: { groupTurnPromptEnabled: false },
      characters: [{ id: "char-1", data: { name: "Marina" } }],
    });

    await drainGeneration(startGeneration(deps, { chatId: "chat-1", forCharacterId: "char-1", impersonateBlockAgents: true }));

    expect((streamedRequests[0] as { messages: Array<{ content: string }> }).messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "[Generation instruction: respond as Marina.]" })]),
    );
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

    const results = await retryGenerationAgents(deps, {
      chatId: "chat-1",
      agentTypes: ["lorebook-keeper"],
      options: { lorebookKeeperBackfill: true },
    });

    expect(results).toHaveLength(2);
    expect(streamedRequests).toHaveLength(2);
    expect(streamedRequests.map((request) => (request as { messages: Array<{ content: string }> }).messages.at(-1)?.content)).toEqual([
      expect.stringContaining("Assistant message 20"),
      expect.stringContaining("Assistant message 30"),
    ]);
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

    const results = await retryGenerationAgents(deps, {
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

    const results = await retryGenerationAgents(deps, {
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
