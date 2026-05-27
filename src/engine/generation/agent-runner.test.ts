import { describe, expect, it } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { createGenerationAgentRuntime } from "./agent-runner";

function storage(rows: Record<string, unknown>[], collections: Record<string, Record<string, unknown>[]> = {}): StorageGateway {
  return {
    list: async <T,>(entity: string) => (entity === "agents" ? rows : (collections[entity] ?? [])) as T[],
    get: async <T,>() => null as T | null,
    create: async <T,>() => ({}) as T,
    update: async <T,>() => ({}) as T,
    delete: async () => ({ deleted: true }),
    listChatMessages: async () => [],
    createChatMessage: async <T,>() => ({}) as T,
    updateChatMessage: async <T,>() => ({}) as T,
    deleteChatMessage: async () => ({ deleted: true }),
    patchChatMessageExtra: async <T,>() => ({}) as T,
    addChatMessageSwipe: async <T,>() => ({}) as T,
    patchChatMetadata: async <T,>() => ({}) as T,
    patchChatSummaries: async <T,>() => ({}) as T,
    listChatMemories: async () => [],
    getWorldState: async <T,>() => null as T | null,
    saveTrackerSnapshot: async <T,>() => ({}) as T,
    listLorebookEntries: async () => [],
    createLorebookEntries: async () => [],
    promptFull: async <T,>() => null as T | null,
  };
}

const llm: LlmGateway = {
  async *stream() {
    yield { type: "token", text: "ok" };
  },
  async complete() {
    return "ok";
  },
  async listModels() {
    return [];
  },
};

function countingLlm(calls: unknown[], responseText = "ok"): LlmGateway {
  return {
    async *stream(request) {
      calls.push(request);
      yield { type: "token", text: responseText };
    },
    async complete() {
      return responseText;
    },
    async listModels() {
      return [];
    },
  };
}

const integrations = {} as IntegrationGateway;

const illustratorDrawData = {
  shouldGenerate: true,
  reason: "Important visual beat",
  prompt: "moonlit tavern confrontation",
};
const illustratorDrawResponse = JSON.stringify(illustratorDrawData);
const illustratorNoDrawData = {
  shouldGenerate: false,
  reason: "No major visual change",
  prompt: "",
};

describe("createGenerationAgentRuntime", () => {
  it("runs chat-scoped active agents even when the legacy enable flag is absent", async () => {
    const results: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
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
        ]),
        llm,
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { activeAgentIds: ["agent-a"] } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
      (result) => results.push(result),
    );

    expect(runtime.preResults).toHaveLength(1);
    expect(runtime.preResults[0]).toMatchObject({
      agentId: "agent-a",
      agentType: "prose-guardian",
      success: true,
    });
    expect(runtime.preInjections).toEqual([
      expect.objectContaining({
        agentType: "prose-guardian",
        agentName: "Prose Guardian",
        text: "ok",
      }),
    ]);
    expect(results).toEqual(runtime.preResults);
  });

  it("skips agents with dangling connection ids instead of falling back to the chat connection", async () => {
    const results: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
          {
            id: "agent-a",
            type: "director",
            name: "Director",
            enabled: true,
            phase: "pre_generation",
            connectionId: "missing-connection",
            model: "agent-model",
            promptTemplate: "Direct the scene.",
          },
        ]),
        llm,
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
      (result) => results.push(result),
    );

    expect(runtime.preResults).toHaveLength(1);
    expect(runtime.preResults[0]).toMatchObject({
      agentId: "agent-a",
      agentType: "director",
      success: false,
      data: {
        code: "dangling_agent_connection",
        connectionId: "missing-connection",
      },
    });
    expect(runtime.preInjections).toEqual([]);
    expect(results).toEqual(runtime.preResults);
  });

  it("skips custom agents when activation keywords miss the scan window", async () => {
    const calls: unknown[] = [];
    const listedEntities: string[] = [];
    const testStorage = storage([
      {
        id: "agent-a",
        type: "custom-scene-scout",
        name: "Scene Scout",
        enabled: true,
        phase: "pre_generation",
        connectionId: null,
        promptTemplate: "Watch for scene keywords.",
        settings: {
          resultType: "context_injection",
          activationKeywords: ["secret"],
          activationScanDepth: 1,
        },
      },
    ]);
    const runtime = await createGenerationAgentRuntime(
      {
        storage: {
          ...testStorage,
          async list<T>(entity: string) {
            listedEntities.push(entity);
            return testStorage.list<T>(entity);
          },
        },
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { role: "user", content: "The secret door glows." },
          { role: "assistant", content: "The room is quiet." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toEqual([]);
    expect(runtime.preInjections).toEqual([]);
    expect(await runtime.runParallel()).toEqual([]);
    expect(await runtime.runPost("response")).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(listedEntities).toEqual(["agents"]);
  });

  it("runs custom agents when activation keywords match inside the scan window", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
          {
            id: "agent-a",
            type: "custom-scene-scout",
            name: "Scene Scout",
            enabled: true,
            phase: "pre_generation",
            connectionId: null,
            promptTemplate: "Watch for scene keywords.",
            settings: {
              resultType: "context_injection",
              activationKeywords: ["secret"],
              activationScanDepth: 2,
            },
          },
        ]),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { role: "user", content: "The secret door glows." },
          { role: "assistant", content: "The room is quiet." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preInjections).toEqual([
      {
        agentType: "custom-scene-scout",
        agentName: "Scene Scout",
        text: "ok",
      },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("runs custom agents with legacy string activation settings", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
          {
            id: "agent-a",
            type: "custom-scene-scout",
            name: "Scene Scout",
            enabled: true,
            phase: "pre_generation",
            connectionId: null,
            promptTemplate: "Watch for scene keywords.",
            settings: {
              resultType: "context_injection",
              activationKeywords: "secret, moonlit ritual",
              activationScanDepth: "1",
            },
          },
        ]),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ role: "user", content: "The moonlit ritual begins." }],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preInjections).toEqual([
      {
        agentType: "custom-scene-scout",
        agentName: "Scene Scout",
        text: "ok",
      },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("runs custom agents with missed activation keywords when explicitly bypassed", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
          {
            id: "agent-a",
            type: "custom-scene-scout",
            name: "Scene Scout",
            enabled: true,
            phase: "pre_generation",
            connectionId: null,
            promptTemplate: "Watch for scene keywords.",
            settings: {
              resultType: "context_injection",
              activationKeywords: ["secret"],
              activationScanDepth: 1,
            },
          },
        ]),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { role: "user", content: "The secret door glows." },
          { role: "assistant", content: "The room is quiet." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
        bypassCustomAgentActivation: true,
      },
    );

    expect(runtime.preInjections).toEqual([
      {
        agentType: "custom-scene-scout",
        agentName: "Scene Scout",
        text: "ok",
      },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("skips automatic Illustrator runs until the assistant-message interval has elapsed", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "illustrator",
              name: "Illustrator",
              enabled: true,
              phase: "post_processing",
              connectionId: null,
              promptTemplate: "Decide whether to draw this scene.",
              settings: { runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "illustrator",
                resultType: "image_prompt",
                resultData: illustratorDrawData,
                messageId: "assistant-1",
                success: true,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        ),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { id: "assistant-1", role: "assistant", content: "First illustrated reply." },
          { id: "assistant-2", role: "assistant", content: "Second reply." },
          { id: "assistant-3", role: "assistant", content: "Third reply." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toEqual([]);
    expect(await runtime.runParallel()).toEqual([]);
    expect(await runtime.runPost("response")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("uses legacy type fields and string result data on persisted Illustrator runs when gating automatic intervals", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "illustrator",
              name: "Illustrator",
              enabled: true,
              phase: "post_processing",
              connectionId: null,
              promptTemplate: "Decide whether to draw this scene.",
              settings: { runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                type: "illustrator",
                resultType: "image_prompt",
                resultData: JSON.stringify(illustratorDrawData),
                messageId: "assistant-1",
                success: true,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        ),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { id: "assistant-1", role: "assistant", content: "First illustrated reply." },
          { id: "assistant-2", role: "assistant", content: "Second reply." },
          { id: "assistant-3", role: "assistant", content: "Third reply." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(await runtime.runPost("response")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("does not let no-draw Illustrator decisions reset the automatic run interval", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "illustrator",
              name: "Illustrator",
              enabled: true,
              phase: "post_processing",
              connectionId: null,
              promptTemplate: "Decide whether to draw this scene.",
              settings: { runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "illustrator",
                resultType: "image_prompt",
                resultData: illustratorDrawData,
                messageId: "assistant-1",
                success: true,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              {
                chatId: "chat-a",
                agentType: "illustrator",
                resultType: "image_prompt",
                resultData: illustratorNoDrawData,
                messageId: "assistant-4",
                success: true,
                createdAt: "2026-01-01T00:04:00.000Z",
              },
            ],
          },
        ),
        llm: countingLlm(calls, illustratorDrawResponse),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { id: "assistant-1", role: "assistant", content: "First illustrated reply." },
          { id: "assistant-2", role: "assistant", content: "Second reply." },
          { id: "assistant-3", role: "assistant", content: "Third reply." },
          { id: "assistant-4", role: "assistant", content: "Fourth reply with no new image." },
          { id: "assistant-5", role: "assistant", content: "Fifth reply." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    const results = await runtime.runPost("response");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      agentId: "agent-a",
      agentType: "illustrator",
      success: true,
      data: illustratorDrawData,
    });
    expect(calls).toHaveLength(1);
  });

  it("chooses the latest transcript-position Illustrator run over a newer retry of an older message", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "illustrator",
              name: "Illustrator",
              enabled: true,
              phase: "post_processing",
              connectionId: null,
              promptTemplate: "Decide whether to draw this scene.",
              settings: { runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "illustrator",
                resultType: "image_prompt",
                resultData: illustratorDrawData,
                messageId: "assistant-5",
                success: true,
                createdAt: "2026-01-01T00:05:00.000Z",
              },
              {
                chatId: "chat-a",
                agentType: "illustrator",
                resultType: "image_prompt",
                resultData: illustratorDrawData,
                messageId: "assistant-1",
                success: true,
                createdAt: "2026-01-01T00:10:00.000Z",
              },
            ],
          },
        ),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { id: "assistant-1", role: "assistant", content: "First illustrated reply." },
          { id: "assistant-2", role: "assistant", content: "Second reply." },
          { id: "assistant-3", role: "assistant", content: "Third reply." },
          { id: "assistant-4", role: "assistant", content: "Fourth reply." },
          { id: "assistant-5", role: "assistant", content: "Fifth illustrated reply." },
          { id: "assistant-6", role: "assistant", content: "Sixth reply." },
          { id: "assistant-7", role: "assistant", content: "Seventh reply." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(await runtime.runPost("response")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("runs automatic Illustrator when the assistant-message interval has elapsed", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "illustrator",
              name: "Illustrator",
              enabled: true,
              phase: "post_processing",
              connectionId: null,
              promptTemplate: "Decide whether to draw this scene.",
              settings: { runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "illustrator",
                resultType: "image_prompt",
                resultData: illustratorDrawData,
                messageId: "assistant-1",
                success: true,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        ),
        llm: countingLlm(calls, illustratorDrawResponse),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { id: "assistant-1", role: "assistant", content: "First illustrated reply." },
          { id: "assistant-2", role: "assistant", content: "Second reply." },
          { id: "assistant-3", role: "assistant", content: "Third reply." },
          { id: "assistant-4", role: "assistant", content: "Fourth reply." },
          { id: "assistant-5", role: "assistant", content: "Fifth reply." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    const results = await runtime.runPost("response");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      agentId: "agent-a",
      agentType: "illustrator",
      success: true,
    });
    expect(calls).toHaveLength(1);
  });

  it("lets explicit Illustrator retries bypass the automatic run interval", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "illustrator",
              name: "Illustrator",
              enabled: true,
              phase: "post_processing",
              connectionId: null,
              promptTemplate: "Decide whether to draw this scene.",
              settings: { runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "illustrator",
                resultType: "image_prompt",
                resultData: illustratorDrawData,
                messageId: "assistant-1",
                success: true,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        ),
        llm: countingLlm(calls, illustratorDrawResponse),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [
          { id: "assistant-1", role: "assistant", content: "First illustrated reply." },
          { id: "assistant-2", role: "assistant", content: "Second reply." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
        agentTypes: new Set(["illustrator"]),
      },
    );

    const results = await runtime.runPost("response");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      agentId: "agent-a",
      agentType: "illustrator",
      success: true,
    });
    expect(calls).toHaveLength(1);
  });
});
