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
});
