import { describe, expect, it } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmRequest } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { createGenerationAgentRuntime } from "./agent-runner";

function storage(
  rows: Record<string, unknown>[],
  collections: Record<string, Record<string, unknown>[]> = {},
): StorageGateway {
  return {
    list: async <T>(entity: string) => (entity === "agents" ? rows : (collections[entity] ?? [])) as T[],
    get: async <T>() => null as T | null,
    create: async <T>() => ({}) as T,
    update: async <T>() => ({}) as T,
    delete: async () => ({ deleted: true }),
    listChatMessages: async () => [],
    createChatMessage: async <T>() => ({}) as T,
    updateChatMessage: async <T>() => ({}) as T,
    deleteChatMessage: async () => ({ deleted: true }),
    patchChatMessageExtra: async <T>() => ({}) as T,
    addChatMessageSwipe: async <T>() => ({}) as T,
    patchChatMetadata: async <T>() => ({}) as T,
    patchChatSummaries: async <T>() => ({}) as T,
    listChatMemories: async () => [],
    getWorldState: async <T>() => null as T | null,
    saveTrackerSnapshot: async <T>() => ({}) as T,
    listLorebookEntries: async <T>(lorebookId: string) =>
      (collections["lorebook-entries"] ?? []).filter((entry) => entry.lorebookId === lorebookId) as T[],
    createLorebookEntries: async () => [],
    promptFull: async <T>() => null as T | null,
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

function batchingAwareLlm(calls: LlmRequest[]): LlmGateway {
  return {
    async *stream(request) {
      calls.push(request);
      const systemPrompt = request.messages[0]?.content ?? "";
      if (systemPrompt.includes("collection of 2 specialized agents")) {
        yield {
          type: "token",
          text: [
            '<result agent="prose-guardian">Keep the prose direct.</result>',
            '<result agent="director">[Director\'s note: Add a ticking clock.]</result>',
          ].join("\n"),
        };
        return;
      }
      yield { type: "token", text: "single agent fallback" };
    },
    async complete() {
      return "single agent fallback";
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
      yield* [];
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
      execute: async <T = unknown>(input: { toolName: string; arguments: unknown }) => (await execute(input)) as T,
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

  it("loads selected lorebook entries into Knowledge Retrieval source material", async () => {
    const calls: LlmRequest[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "knowledge-a",
              type: "knowledge-retrieval",
              name: "Knowledge Retrieval",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              model: "agent-model",
              promptTemplate: "Return the relevant source facts.",
              settings: { sourceLorebookIds: ["lorebook-a"] },
            },
          ],
          {
            lorebooks: [{ id: "lorebook-a", excludeFromVectorization: false }],
            "lorebook-entries": [
              {
                id: "entry-docks",
                lorebookId: "lorebook-a",
                name: "Harbor Secret",
                content: "The dockmaster hides the blue key under the west pier.",
                enabled: true,
              },
              {
                id: "entry-disabled",
                lorebookId: "lorebook-a",
                name: "Disabled",
                content: "This should not be offered to the retrieval agent.",
                enabled: false,
              },
            ],
          },
        ),
        llm: countingLlm(calls, "The blue key is under the west pier."),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { activeAgentIds: ["knowledge-a"] } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ id: "user-1", role: "user", content: "Where would the key be hidden?" }],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preInjections).toEqual([
      {
        agentType: "knowledge-retrieval",
        agentName: "Knowledge Retrieval",
        text: "The blue key is under the west pier.",
      },
    ]);
    expect(calls).toHaveLength(1);
    const systemPrompt = calls[0]?.messages[0]?.content ?? "";
    expect(systemPrompt).toContain("<source_material>");
    expect(systemPrompt).toContain("### Harbor Secret");
    expect(systemPrompt).toContain("The dockmaster hides the blue key under the west pier.");
    expect(systemPrompt).not.toContain("This should not be offered to the retrieval agent.");
  });

  it("routes Knowledge Router over selected lorebook entries and injects chosen content verbatim", async () => {
    const calls: LlmRequest[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "router-a",
              type: "knowledge-router",
              name: "Knowledge Router",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              model: "agent-model",
              promptTemplate: 'Return JSON like {"entryIds":["id"]}.',
              settings: { sourceLorebookIds: ["lorebook-a"] },
            },
          ],
          {
            lorebooks: [{ id: "lorebook-a", excludeFromVectorization: false }],
            "lorebook-entries": [
              {
                id: "entry-clocktower",
                lorebookId: "lorebook-a",
                name: "Clocktower",
                description: "Where the silver bell is hidden.",
                content: "The silver bell is sealed behind the clocktower face.",
                enabled: true,
                keys: ["bell"],
              },
              {
                id: "entry-constant",
                lorebookId: "lorebook-a",
                name: "Always Injected",
                description: "Already handled by normal lore injection.",
                content: "This constant entry should not be routed.",
                enabled: true,
                constant: true,
              },
            ],
          },
        ),
        llm: countingLlm(calls, '{"entryIds":["entry-clocktower","entry-constant","entry-clocktower","missing"]}'),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { activeAgentIds: ["router-a"] } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ id: "user-1", role: "user", content: "What about the bell?" }],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preInjections).toEqual([
      {
        agentType: "knowledge-router",
        agentName: "Knowledge Router",
        text: "### Clocktower\nThe silver bell is sealed behind the clocktower face.",
      },
    ]);
    expect(calls).toHaveLength(1);
    const systemPrompt = calls[0]?.messages[0]?.content ?? "";
    expect(systemPrompt).toContain("<entry_catalog>");
    expect(systemPrompt).toContain('id="entry-clocktower"');
    expect(systemPrompt).not.toContain("entry-constant");
  });

  it("merges connection generation parameters into agent LLM calls", async () => {
    const calls: LlmRequest[] = [];
    await createGenerationAgentRuntime(
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
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { activeAgentIds: ["agent-a"] } },
        connection: {
          id: "chat-connection",
          model: "chat-model",
          defaultParameters: {
            topP: 0.42,
            topK: 12,
            reasoningEffort: "high",
            assistantPrefill: "Here is the agent result:",
          },
        },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(calls[0]?.parameters).toMatchObject({
      maxTokens: 4096,
      topP: 0.42,
      topK: 12,
      reasoningEffort: "high",
      assistantPrefill: "Here is the agent result:",
    });
    expect(calls[0]?.parameters).not.toHaveProperty("temperature");
  });

  it("uses the default agent connection before the chat connection when no agent override is set", async () => {
    const calls: LlmRequest[] = [];
    await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "agent-a",
              type: "prose-guardian",
              name: "Prose Guardian",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              model: "",
              promptTemplate: "Add a concise style note.",
            },
          ],
          {
            connections: [
              {
                id: "agent-default",
                provider: "anthropic",
                model: "agent-default-model",
                defaultForAgents: true,
                defaultParameters: { topP: 0.61 },
              },
            ],
          },
        ),
        llm: countingLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { activeAgentIds: ["agent-a"] } },
        connection: {
          id: "chat-connection",
          provider: "google",
          model: "chat-model",
          defaultParameters: { topP: 0.24 },
        },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(calls[0]).toMatchObject({
      connectionId: "agent-default",
      model: "agent-default-model",
      parameters: expect.objectContaining({ topP: 0.61 }),
    });
  });

  it("does not run Echo Chamber during assistant message regeneration", async () => {
    const calls: LlmRequest[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([]),
        llm: countingLlm(calls, '{"reactions":[]}'),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { activeAgentIds: ["echo-chamber"] } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ id: "assistant-1", role: "assistant", content: "Old swipe." }],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
        regenerateMessageId: "assistant-1",
      },
    );

    expect(await runtime.runParallel()).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("batches same-connection phase agents into one request even when maxParallelJobs is configured", async () => {
    const calls: LlmRequest[] = [];
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
            promptTemplate: "Return a prose note.",
            settings: { maxParallelJobs: 4 },
          },
          {
            id: "agent-b",
            type: "director",
            name: "Director",
            enabled: true,
            phase: "pre_generation",
            connectionId: null,
            model: "agent-model",
            promptTemplate: "Return a director note.",
            settings: { maxParallelJobs: 4 },
          },
        ]),
        llm: batchingAwareLlm(calls),
        integrations,
      },
      {
        chat: { id: "chat-a", metadata: { activeAgentIds: ["agent-a", "agent-b"] } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preResults).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.parameters).toMatchObject({ maxTokens: 8192 });
    expect(calls[0]?.messages[0]?.content).toContain("<agents>");
    expect(calls[0]?.messages.at(-1)).toMatchObject({
      role: "user",
      content: expect.stringContaining("Output all 2 result blocks"),
    });
    expect(runtime.preInjections).toEqual([
      {
        agentType: "prose-guardian",
        agentName: "Prose Guardian",
        text: "Keep the prose direct.",
      },
      {
        agentType: "director",
        agentName: "Director",
        text: "[Director's note: Add a ticking clock.]",
      },
    ]);
  });

  it("groups same-connection post-processing agents into one batch request", async () => {
    const calls: LlmRequest[] = [];
    const llm: LlmGateway = {
      async *stream(request) {
        calls.push(request);
        yield {
          type: "token",
          text: [
            '<result agent="world-state">{ "updates": [] }</result>',
            '<result agent="expression">{ "expressions": [] }</result>',
            '<result agent="background">{ "chosen": "lab.png" }</result>',
          ].join("\n"),
        };
      },
      async complete() {
        return "";
      },
      async listModels() {
        return [];
      },
    };
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage([
          {
            id: "world",
            type: "world-state",
            name: "World State",
            enabled: true,
            phase: "post_processing",
            connectionId: null,
            model: "agent-model",
            promptTemplate: "Track world state.",
            settings: { includeParallelResults: false },
          },
          {
            id: "expression",
            type: "expression",
            name: "Expression Engine",
            enabled: true,
            phase: "post_processing",
            connectionId: null,
            model: "agent-model",
            promptTemplate: "Pick expressions.",
            settings: { includeParallelResults: true },
          },
          {
            id: "background",
            type: "background",
            name: "Background",
            enabled: true,
            phase: "post_processing",
            connectionId: null,
            model: "agent-model",
            promptTemplate: "Pick a background.",
            settings: { includePreGenInjections: true },
          },
        ]),
        llm,
        integrations,
        visuals: {
          listSprites: async (characterId) =>
            characterId === "char-dottore" ? [{ expression: "happy_01" }, { expression: "full_idle" }] : [],
          listBackgrounds: async () => [{ filename: "lab.png", originalName: "Laboratory", tags: ["fatui", "lab"] }],
          gameAssetsManifest: async () => ({
            byCategory: {
              backgrounds: [
                {
                  tag: "backgrounds:fatui:winter_lab",
                  category: "backgrounds",
                  subcategory: "fatui",
                  name: "winter_lab",
                  path: "backgrounds/fatui/winter_lab.webp",
                },
              ],
            },
          }),
        },
      },
      {
        chat: {
          id: "chat-a",
          metadata: {
            activeAgentIds: ["world", "expression", "background"],
            spriteCharacterIds: ["char-dottore"],
            spriteDisplayModes: ["expressions", "full-body"],
          },
        },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ role: "user", content: "The lab door opens." }],
        characters: [{ id: "char-dottore", name: "Dottore", description: "A precise Harbinger.", tags: [] }],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    const results = await runtime.runPost("Dottore gestures to the room.");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.parameters).toMatchObject({ maxTokens: 12288 });
    const systemPrompt = calls[0]?.messages[0]?.content ?? "";
    expect(systemPrompt).toContain('<agent_task id="world-state" name="World State">');
    expect(systemPrompt).toContain('<agent_task id="expression" name="Expression Engine">');
    expect(systemPrompt).toContain('<agent_task id="background" name="Background">');
    expect(systemPrompt).toContain("<available_sprites>");
    expect(systemPrompt).toContain("Dottore (char-dottore):");
    expect(systemPrompt).toContain("neutral");
    expect(systemPrompt).toContain("happy_01");
    expect(systemPrompt).toContain("full_idle");
    expect(systemPrompt).toContain("<available_backgrounds>");
    expect(systemPrompt).toContain("- lab.png (Laboratory) [tags: fatui, lab]");
    expect(systemPrompt).toContain("- gameAsset:backgrounds/fatui/winter_lab.webp");
    expect(results).toEqual([
      expect.objectContaining({ agentType: "world-state", success: true }),
      expect.objectContaining({ agentType: "expression", success: true }),
      expect.objectContaining({ agentType: "background", success: true }),
    ]);
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

  it("scopes knowledge retrieval source material to active chat lorebooks", async () => {
    const calls: LlmRequest[] = [];
    const baseStorage = storage(
      [
        {
          id: "knowledge-retrieval",
          type: "knowledge-retrieval",
          name: "Knowledge Retrieval",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Extract relevant lore.",
          settings: {},
        },
      ],
      {
        lorebooks: [
          { id: "active-lorebook", enabled: true, name: "Active Lore" },
          { id: "other-lorebook", enabled: true, name: "Other Lore" },
        ],
      },
    );
    const entriesByLorebook: Record<string, Record<string, unknown>[]> = {
      "active-lorebook": [
        {
          id: "active-entry",
          lorebookId: "active-lorebook",
          name: "Correct City",
          content: "The active city is Hearthglass.",
          enabled: true,
        },
      ],
      "other-lorebook": [
        {
          id: "other-entry",
          lorebookId: "other-lorebook",
          name: "Wrong City",
          content: "The unrelated city is Wrongport.",
          enabled: true,
        },
      ],
    };

    const runtime = await createGenerationAgentRuntime(
      {
        storage: {
          ...baseStorage,
          listLorebookEntries: async <T>(lorebookId: string) => (entriesByLorebook[lorebookId] ?? []) as T[],
        },
        llm: countingLlm(calls, "Use Hearthglass as the city."),
        integrations,
      },
      {
        chat: {
          id: "chat-a",
          mode: "roleplay",
          metadata: { enableAgents: true, activeLorebookIds: ["active-lorebook"] },
        },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ role: "user", content: "Where are we?" }],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preInjections).toEqual([
      { agentType: "knowledge-retrieval", agentName: "Knowledge Retrieval", text: "Use Hearthglass as the city." },
    ]);
    expect(calls).toHaveLength(1);
    const promptText = calls[0]!.messages.map((message) => message.content).join("\n");
    expect(promptText).toContain("The active city is Hearthglass.");
    expect(promptText).not.toContain("Wrongport");
  });

  it("excludes generated game lorebook-keeper books from knowledge agent sources when the keeper is disabled", async () => {
    const calls: LlmRequest[] = [];
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storage(
          [
            {
              id: "knowledge-retrieval",
              type: "knowledge-retrieval",
              name: "Knowledge Retrieval",
              enabled: true,
              phase: "pre_generation",
              connectionId: null,
              model: "agent-model",
              promptTemplate: "Extract relevant lore.",
              settings: { sourceLorebookIds: ["keeper-book"] },
            },
          ],
          {
            lorebooks: [
              {
                id: "keeper-book",
                enabled: true,
                isGlobal: true,
                sourceAgentId: "game-lorebook-keeper",
              },
            ],
            "lorebook-entries": [
              {
                id: "keeper-entry",
                lorebookId: "keeper-book",
                name: "Keeper Internal Lore",
                content: "This generated game keeper lore should not leak.",
                enabled: true,
              },
            ],
          },
        ),
        llm: countingLlm(calls, "Leaked keeper lore."),
        integrations,
      },
      {
        chat: {
          id: "chat-a",
          mode: "game",
          metadata: {
            activeAgentIds: ["knowledge-retrieval"],
            gameLorebookKeeperEnabled: false,
            gameLorebookKeeperLorebookId: "keeper-book",
          },
        },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ role: "user", content: "What does the keeper know?" }],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preInjections).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("scopes knowledge router candidates to lorebooks linked to active characters", async () => {
    const calls: LlmRequest[] = [];
    const baseStorage = storage(
      [
        {
          id: "knowledge-router",
          type: "knowledge-router",
          name: "Knowledge Router",
          enabled: true,
          phase: "pre_generation",
          connectionId: null,
          model: "agent-model",
          promptTemplate: "Select relevant entries.",
          settings: {},
        },
      ],
      {
        lorebooks: [
          { id: "character-lorebook", enabled: true, name: "Character Lore", characterIds: ["char-a"] },
          { id: "unlinked-lorebook", enabled: true, name: "Unlinked Lore" },
        ],
      },
    );
    const entriesByLorebook: Record<string, Record<string, unknown>[]> = {
      "character-lorebook": [
        {
          id: "char-entry",
          lorebookId: "character-lorebook",
          name: "Character Secret",
          content: "Dottore knows the sealed archive.",
          description: "Secret archive knowledge.",
          enabled: true,
        },
      ],
      "unlinked-lorebook": [
        {
          id: "unlinked-entry",
          lorebookId: "unlinked-lorebook",
          name: "Wrong Secret",
          content: "Unlinked lore should not leak.",
          description: "Wrong leak.",
          enabled: true,
        },
      ],
    };

    const runtime = await createGenerationAgentRuntime(
      {
        storage: {
          ...baseStorage,
          listLorebookEntries: async <T>(lorebookId: string) => (entriesByLorebook[lorebookId] ?? []) as T[],
        },
        llm: countingLlm(calls, JSON.stringify({ entryIds: ["char-entry", "unlinked-entry"] })),
        integrations,
      },
      {
        chat: { id: "chat-a", mode: "roleplay", metadata: { enableAgents: true } },
        connection: { id: "chat-connection", model: "chat-model" },
        storedMessages: [{ role: "user", content: "What does he know?" }],
        characters: [{ id: "char-a", name: "Dottore", description: "", tags: [] }],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    expect(runtime.preInjections).toEqual([
      {
        agentType: "knowledge-router",
        agentName: "Knowledge Router",
        text: "### Character Secret\nDottore knows the sealed archive.",
      },
    ]);
    expect(calls).toHaveLength(1);
    const promptText = calls[0]!.messages.map((message) => message.content).join("\n");
    expect(promptText).toContain("Character Secret");
    expect(promptText).not.toContain("Wrong Secret");
  });
});
