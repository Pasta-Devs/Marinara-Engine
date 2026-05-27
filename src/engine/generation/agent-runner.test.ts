import { describe, expect, it } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { createGenerationAgentRuntime } from "./agent-runner";

function storage(rows: Record<string, unknown>[]): StorageGateway {
  return {
    list: async <T,>(entity: string) => (entity === "agents" ? rows : []) as T[],
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

function countingLlm(calls: unknown[]): LlmGateway {
  return {
    async *stream(request) {
      calls.push(request);
      yield { type: "token", text: "ok" };
    },
    async complete() {
      return "ok";
    },
    async listModels() {
      return [];
    },
  };
}

const integrations = {} as IntegrationGateway;

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
});
