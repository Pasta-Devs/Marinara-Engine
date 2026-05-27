import { describe, expect, it } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmRequest } from "../capabilities/llm";
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

function emptyLlm(calls: unknown[]): LlmGateway {
  return {
    async *stream(request) {
      calls.push(request);
    },
    async complete() {
      return "";
    },
    async listModels() {
      return [];
    },
  };
}

function toolCallingLlm(
  calls: LlmRequest[],
  toolName: string,
  args: Record<string, unknown>,
  finalResponse = "tool done",
): LlmGateway {
  let turn = 0;
  return {
    async *stream(request) {
      calls.push(request);
      if (turn === 0) {
        turn += 1;
        yield {
          type: "tool_call",
          data: {
            id: `call-${toolName}`,
            function: { name: toolName, arguments: JSON.stringify(args) },
          },
        };
        return;
      }
      turn += 1;
      yield { type: "token", text: finalResponse };
    },
    async complete() {
      return finalResponse;
    },
    async listModels() {
      return [];
    },
  };
}

function integrationWithCustomTool(
  execute: (input: { toolName: string; arguments: unknown }) => Promise<unknown>,
): IntegrationGateway {
  const empty = async <T = unknown>() => ({}) as T;
  return {
    customTools: {
      execute: async <T = unknown>(input: { toolName: string; arguments: unknown }) =>
        (await execute(input)) as T,
    },
    spotify: {
      player: empty,
      playlists: empty,
      playlistTracks: empty,
      searchTracks: empty,
      playTrack: empty,
      play: empty,
      volume: empty,
    },
    haptic: {
      command: empty,
      stopAll: empty,
    },
    image: {
      generate: empty,
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

  it("surfaces empty agent responses as visible failures instead of silent no-op results", async () => {
    const calls: unknown[] = [];
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
        llm: emptyLlm(calls),
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

    expect(calls).toHaveLength(1);
    expect(runtime.preInjections).toEqual([]);
    expect(runtime.preResults).toEqual([
      expect.objectContaining({
        agentId: "agent-a",
        agentType: "prose-guardian",
        success: false,
        error: "Prose Guardian returned an empty response.",
      }),
    ]);
    expect(results).toEqual(runtime.preResults);
  });

  it("passes roleplay Spotify DJ source constraints to the Spotify agent", async () => {
    const calls: LlmRequest[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
          {
            id: "spotify-agent",
            type: "spotify",
            name: "Spotify DJ",
            enabled: true,
            phase: "post_processing",
            connectionId: null,
            model: "agent-model",
            promptTemplate: "Pick music.",
            settings: { enabledTools: [] },
          },
        ]),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: {
          id: "chat-a",
          mode: "roleplay",
          metadata: {
            activeAgentIds: ["spotify"],
            spotifySourceType: "artist",
            spotifyArtist: "HOYO-MiX",
          },
        },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ role: "user", content: "The scene turns melancholy." }],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    await runtime.runPost("The rain starts.");

    const systemPrompt = calls[0]?.messages?.[0]?.content ?? "";
    expect(systemPrompt).toContain("<spotify_dj_constraints>");
    expect(systemPrompt).toContain('"sourceType":"artist"');
    expect(systemPrompt).toContain('"artist":"HOYO-MiX"');
  });

  it("advertises and executes script custom tools for tool-capable agents", async () => {
    const calls: LlmRequest[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "custom-calculator",
              name: "Calculator",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              model: "agent-model",
              promptTemplate: "Use the calculator tool.",
              settings: {
                resultType: "context_injection",
                enabledTools: ["legacy_calc"],
              },
            },
          ],
          {
            "custom-tools": [
              {
                id: "tool-a",
                name: "legacy_calc",
                description: "Add two numbers.",
                enabled: true,
                executionType: "script",
                parametersSchema: {
                  type: "object",
                  properties: {
                    a: { type: "number" },
                    b: { type: "number" },
                  },
                },
                webhookUrl: null,
                staticResult: null,
                scriptBody: "return { sum: arguments.a + arguments.b };",
              },
            ],
          },
        ),
        llm: toolCallingLlm(calls, "legacy_calc", { a: 2, b: 3 }),
        integrations,
      },
      {
        chat: {
          id: "chat-a",
          metadata: {
            enableAgents: true,
            activeAgentIds: ["agent-a"],
            enableTools: true,
            activeToolIds: ["legacy_calc"],
          },
        },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toEqual([
      expect.objectContaining({
        agentId: "agent-a",
        agentType: "custom-calculator",
        success: true,
        data: { text: "tool done" },
      }),
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.tools?.map((tool) => tool.name)).toEqual(["legacy_calc"]);
    const toolMessages = calls[1]!.messages.filter((message) => message.role === "tool");
    expect(toolMessages).toHaveLength(1);
    expect(JSON.parse(toolMessages[0]!.content) as { sum: number }).toEqual({ sum: 5 });
  });

  it("routes static custom tool calls through the Tauri custom-tool integration for agents", async () => {
    const calls: LlmRequest[] = [];
    const customToolCalls: Array<{ toolName: string; arguments: unknown }> = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "custom-weather",
              name: "Weather Scout",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              model: "agent-model",
              promptTemplate: "Use the weather tool.",
              settings: {
                resultType: "context_injection",
                enabledTools: ["weather_report"],
              },
            },
          ],
          {
            "custom-tools": [
              {
                id: "tool-a",
                name: "weather_report",
                description: "Return the current weather.",
                enabled: true,
                executionType: "static",
                parametersSchema: {
                  type: "object",
                  properties: {
                    city: { type: "string" },
                  },
                },
                webhookUrl: null,
                staticResult: "cloudy",
                scriptBody: null,
              },
            ],
          },
        ),
        llm: toolCallingLlm(calls, "weather_report", { city: "Gdansk" }, "weather noted"),
        integrations: integrationWithCustomTool(async (input) => {
          customToolCalls.push(input);
          return { result: `Forecast for ${(input.arguments as { city?: string }).city}: cloudy` };
        }),
      },
      {
        chat: {
          id: "chat-a",
          metadata: {
            enableAgents: true,
            activeAgentIds: ["agent-a"],
            enableTools: true,
            activeToolIds: ["weather_report"],
          },
        },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toEqual([
      expect.objectContaining({
        agentId: "agent-a",
        agentType: "custom-weather",
        success: true,
        data: { text: "weather noted" },
      }),
    ]);
    expect(customToolCalls).toEqual([{ toolName: "weather_report", arguments: { city: "Gdansk" } }]);
    expect(calls[0]!.tools?.map((tool) => tool.name)).toEqual(["weather_report"]);
    const toolMessages = calls[1]!.messages.filter((message) => message.role === "tool");
    expect(toolMessages).toHaveLength(1);
    expect(toolMessages[0]!.content).toBe("Forecast for Gdansk: cloudy");
  });

  it("injects persisted secret plot memory into the secret plot agent prompt", async () => {
    const calls: LlmRequest[] = [];
    await createGenerationAgentRuntime(
      {
        storage: storage(
          [
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
          {
            "agent-memory": [
              {
                id: "memory-arc",
                agentConfigId: "secret-agent",
                chatId: "chat-a",
                key: "overarchingArc",
                value: JSON.stringify({ description: "Recover the anchor", completed: false }),
              },
              {
                id: "memory-directions",
                agentConfigId: "secret-agent",
                chatId: "chat-a",
                key: "sceneDirections",
                value: JSON.stringify([{ direction: "Send a coded invitation", fulfilled: false }]),
              },
              {
                id: "memory-fulfilled",
                agentConfigId: "secret-agent",
                chatId: "chat-a",
                key: "recentlyFulfilled",
                value: JSON.stringify(["Close the old lead"]),
              },
            ],
          },
        ),
        llm: countingLlm(calls, JSON.stringify({ sceneDirections: [] })),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true, activeAgentIds: ["secret-agent"] } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(calls).toHaveLength(1);
    const promptText = calls[0]!.messages.map((message) => message.content).join("\n");
    expect(promptText).toContain("<secret_plot_state>");
    expect(promptText).toContain("Recover the anchor");
    expect(promptText).toContain("Send a coded invitation");
    expect(promptText).toContain("Close the old lead");
  });

  it("runs chat-scoped built-in agents even before a config row exists", async () => {
    const results: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([]),
        llm,
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true, activeAgentIds: ["prose-guardian"] } },
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
      agentId: "builtin:prose-guardian",
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

  it("lets a per-chat active agent override a disabled global config row", async () => {
    const results: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
          {
            id: "agent-a",
            type: "director",
            name: "Director",
            enabled: false,
            phase: "pre_generation",
            connectionId: null,
            model: "agent-model",
            promptTemplate: "Direct the scene.",
          },
        ]),
        llm,
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { enableAgents: true, activeAgentIds: ["director"] } },
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
      success: true,
    });
    expect(results).toEqual(runtime.preResults);
  });

  it("uses built-in fallbacks for manual agent retries", async () => {
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([]),
        llm,
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: {} },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
        agentTypes: new Set(["prose-guardian"]),
      },
    );

    expect(runtime.preResults).toHaveLength(1);
    expect(runtime.preResults[0]).toMatchObject({
      agentId: "builtin:prose-guardian",
      agentType: "prose-guardian",
      success: true,
    });
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

  it("skips automatic custom agents until their user-message interval has elapsed", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "custom-scene-scout",
              name: "Scene Scout",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              promptTemplate: "Watch for scene keywords.",
              settings: { resultType: "context_injection", runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "custom-scene-scout",
                resultType: "context_injection",
                resultData: { text: "old note" },
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
          { id: "assistant-1", role: "assistant", content: "First response." },
          { id: "user-2", role: "user", content: "Second request." },
          { id: "assistant-2", role: "assistant", content: "Second response." },
          { id: "user-3", role: "user", content: "Third request." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toEqual([]);
    expect(runtime.preInjections).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("uses legacy agentConfigId-only custom runs when enforcing user-message intervals", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "custom-scene-scout",
              name: "Scene Scout",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              promptTemplate: "Watch for scene keywords.",
              settings: { resultType: "context_injection", runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentConfigId: "agent-a",
                resultType: "context_injection",
                resultData: { text: "old note" },
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
          { id: "assistant-1", role: "assistant", content: "First response." },
          { id: "user-2", role: "user", content: "Second request." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toEqual([]);
    expect(runtime.preInjections).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("uses the full cadence timeline when prompt context excludes the previous run anchor", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "custom-scene-scout",
              name: "Scene Scout",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              promptTemplate: "Watch for scene keywords.",
              settings: { resultType: "context_injection", runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "custom-scene-scout",
                resultType: "context_injection",
                resultData: { text: "old note" },
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
        storedMessages: [{ id: "user-1", role: "user", content: "First request." }],
        cadenceMessages: [
          { id: "user-1", role: "user", content: "First request." },
          { id: "assistant-1", role: "assistant", content: "First response." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toEqual([]);
    expect(runtime.preInjections).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("runs automatic custom agents when their user-message interval has elapsed", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "custom-scene-scout",
              name: "Scene Scout",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              promptTemplate: "Watch for scene keywords.",
              settings: { resultType: "context_injection", runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "custom-scene-scout",
                resultType: "context_injection",
                resultData: { text: "old note" },
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
          { id: "assistant-1", role: "assistant", content: "First response." },
          { id: "user-2", role: "user", content: "Second request." },
          { id: "user-3", role: "user", content: "Third request." },
          { id: "user-4", role: "user", content: "Fourth request." },
          { id: "user-5", role: "user", content: "Fifth request." },
          { id: "user-6", role: "user", content: "Sixth request." },
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

  it("lets explicit custom agent retries bypass the automatic user-message interval", async () => {
    const calls: unknown[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "custom-scene-scout",
              name: "Scene Scout",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              promptTemplate: "Watch for scene keywords.",
              settings: { resultType: "context_injection", runInterval: 5 },
            },
          ],
          {
            "agent-runs": [
              {
                chatId: "chat-a",
                agentType: "custom-scene-scout",
                resultType: "context_injection",
                resultData: { text: "old note" },
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
          { id: "assistant-1", role: "assistant", content: "First response." },
          { id: "user-2", role: "user", content: "Second request." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
        agentTypes: new Set(["custom-scene-scout"]),
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
