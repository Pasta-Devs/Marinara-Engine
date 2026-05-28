import { describe, expect, it, vi } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmChunk, LlmGateway, LlmRequest } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { startGeneration, type GenerationEngineDeps } from "./start-generation";
import {
  buildMainToolDefinitions,
  executeMainToolCall,
  normalizeToolCall,
  type CustomToolRecord,
} from "./tools-runtime";

// ──────────────────────────────────────────────
// Stub builders
// ──────────────────────────────────────────────

interface StubChatOptions {
  chatMetadata?: Record<string, unknown>;
  initialMessages?: Array<Record<string, unknown>>;
  customTools?: Array<Record<string, unknown>>;
}

interface LlmScript {
  // Each turn yields the chunks for one stream() invocation.
  turns: Array<LlmChunk[]>;
}

function makeStubDeps(
  options: StubChatOptions & {
    script: LlmScript;
    customToolExecuteImpl?: (input: { toolName: string; arguments: unknown }) => Promise<unknown>;
  },
) {
  const chat: Record<string, unknown> = {
    id: "chat-1",
    mode: "conversation",
    connectionId: "connection-1",
    characterIds: [],
    metadata: options.chatMetadata ?? {},
  };
  const connection = {
    id: "connection-1",
    model: "test-model",
    defaultParameters: {},
  };
  const customTools = options.customTools ?? [];
  const initialMessages =
    options.initialMessages ?? [{ id: "assistant-1", chatId: "chat-1", role: "assistant", content: "What now?" }];

  const messagesById = new Map(initialMessages.map((message) => [String(message.id), message]));
  const allMessages = [...initialMessages];

  const streamedRequests: LlmRequest[] = [];
  let turnIndex = 0;
  const stream: LlmGateway["stream"] = vi.fn(async function* (request) {
    streamedRequests.push(request);
    const chunks = options.script.turns[turnIndex] ?? [];
    turnIndex++;
    for (const chunk of chunks) {
      yield chunk;
    }
  });

  const createChatMessage = vi.fn(async (_chatId: string, value: Record<string, unknown>) => {
    if (value.role === "user") {
      const saved = { id: "user-1", chatId: "chat-1", ...value };
      allMessages.push(saved);
      messagesById.set("user-1", saved);
      return saved;
    }
    const saved = { id: "assistant-2", chatId: "chat-1", ...value };
    allMessages.push(saved);
    messagesById.set("assistant-2", saved);
    return saved;
  });

  const listChatMessages = vi.fn(async () => [...allMessages]);
  const updates: Array<{ entity: string; id: string; patch: Record<string, unknown> }> = [];
  const update = vi.fn(async (entity: string, id: string, patch: Record<string, unknown>) => {
    updates.push({ entity, id, patch });
    if (entity === "chats" && id === "chat-1") {
      Object.assign(chat, patch);
    }
    return { id, ...patch };
  });
  const customToolsExecute = vi.fn(
    options.customToolExecuteImpl ?? (async () => ({ ok: true })),
  );

  const storage: StorageGateway = {
    get: vi.fn(async (entity: string, id: string) => {
      if (entity === "chats" && id === "chat-1") return chat;
      if (entity === "connections" && id === "connection-1") return connection;
      if (entity === "messages") return messagesById.get(id) ?? null;
      return null;
    }),
    list: vi.fn(async (entity: string) => {
      if (entity === "custom-tools") return customTools;
      return [];
    }),
    create: vi.fn(async (_entity: string, value: Record<string, unknown>) => value),
    update,
    delete: vi.fn(async () => ({ deleted: true })),
    listChatMessages,
    createChatMessage,
    updateChatMessage: vi.fn(async (id: string, value: Record<string, unknown>) => ({ id, ...value })),
    deleteChatMessage: vi.fn(async () => ({ deleted: true })),
    patchChatMessageExtra: vi.fn(async (id: string, patch: Record<string, unknown>) => ({ id, ...patch })),
    addChatMessageSwipe: vi.fn(async () => ({})),
    patchChatMetadata: vi.fn(async () => ({})),
    patchChatSummaries: vi.fn(async () => ({})),
    listChatMemories: vi.fn(async () => []),
    getWorldState: vi.fn(async () => null),
    saveTrackerSnapshot: vi.fn(async (_chatId: string, snapshot: Record<string, unknown>) => snapshot),
    listLorebookEntries: vi.fn(async () => []),
    createLorebookEntries: vi.fn(async () => []),
    promptFull: vi.fn(async () => null),
  } as StorageGateway;

  const integrations: IntegrationGateway = {
    customTools: { execute: customToolsExecute },
    spotify: {
      player: vi.fn(),
      playlists: vi.fn(),
      playlistTracks: vi.fn(),
      searchTracks: vi.fn(),
      playTrack: vi.fn(),
      play: vi.fn(),
      volume: vi.fn(),
    },
    haptic: { command: vi.fn(), stopAll: vi.fn() },
    image: { generate: vi.fn() },
  } as IntegrationGateway;

  const llm: LlmGateway = {
    stream,
    complete: vi.fn(async () => ""),
    listModels: vi.fn(async () => []),
  };

  const deps: GenerationEngineDeps = { storage, llm, integrations };
  return {
    deps,
    chat,
    storage,
    integrations,
    streamedRequests,
    createChatMessage,
    customToolsExecute,
    update,
    updates,
    allMessages,
  };
}

type CollectedEvent = { type: string; data: unknown };

async function collectEvents(
  gen: AsyncGenerator<{ type: string; data?: unknown }>,
): Promise<CollectedEvent[]> {
  const events: CollectedEvent[] = [];
  for await (const event of gen) {
    events.push({ type: event.type, data: event.data });
  }
  return events;
}

function toolCallChunk(name: string, args: Record<string, unknown> = {}, id = `call-${name}`): LlmChunk {
  return {
    type: "tool_call",
    data: {
      id,
      function: { name, arguments: JSON.stringify(args) },
    },
  };
}

// ──────────────────────────────────────────────
// Row 1 — Spotify excluded from main path
// ──────────────────────────────────────────────

describe("row 1 — Spotify tool excluded from main path", () => {
  it("does NOT include spotify_play in toolDefs even when actively requested", async () => {
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: ["spotify_play"] },
      script: { turns: [[{ type: "token", text: "no spotify here" }]] },
    });
    const built = await buildMainToolDefinitions({
      chat: {
        id: "chat-1",
        metadata: { enableTools: true, activeToolIds: ["spotify_play"] },
      },
      storage: deps.storage,
      integrations: deps.integrations,
    });
    // activeToolIds contained only a Spotify tool, which is filtered → null
    expect(built).toBeNull();
  });

  it("filters all spotify_* names out when activeToolIds is empty", async () => {
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: [] },
      script: { turns: [[{ type: "token", text: "ok" }]] },
    });
    const built = await buildMainToolDefinitions({
      chat: { id: "chat-1", metadata: { enableTools: true, activeToolIds: [] } },
      storage: deps.storage,
      integrations: deps.integrations,
    });
    expect(built).not.toBeNull();
    const names = built!.toolDefs.map((tool) => tool.name);
    expect(names.filter((name) => name.startsWith("spotify_"))).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// Row 2 — Infinite tool loop terminates at MAX_MAIN_TOOL_ITERATIONS = 8
// ──────────────────────────────────────────────

describe("row 2 — infinite tool loop terminates at MAX_MAIN_TOOL_ITERATIONS = 8", () => {
  it("stops after 8 stream calls and emits the iteration-cap phase event", async () => {
    // 10 turns of repeated roll_dice — should cap at 8.
    const turn: LlmChunk[] = [
      { type: "token", text: "rolling..." },
      toolCallChunk("roll_dice", { notation: "1d6" }),
    ];
    const turns: LlmChunk[][] = Array.from({ length: 10 }, () => turn);
    const { deps, streamedRequests } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: ["roll_dice"] },
      script: { turns },
    });

    const events = await collectEvents(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "fight!",
        impersonateBlockAgents: true,
      }),
    );

    expect(streamedRequests).toHaveLength(8);
    const phaseEvents = events.filter((event) => event.type === "phase");
    const capPhase = phaseEvents.find(
      (event) =>
        typeof event.data === "string" && event.data.includes("Tool-call iteration limit (8)"),
    );
    expect(capPhase).toBeTruthy();
  });
});

// ──────────────────────────────────────────────
// Row 3 — Custom-tool failure surfaces as success: false, doesn't escape loop
// ──────────────────────────────────────────────

describe("row 3 — custom-tool failure surfaces as success: false and does not escape the loop", () => {
  it("emits tool_result with success: false on executor throw, then continues", async () => {
    const turns: LlmChunk[][] = [
      [{ type: "token", text: "trying custom..." }, toolCallChunk("my_tool", { x: 1 })],
      [{ type: "token", text: "done." }],
    ];
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: ["my_tool"] },
      customTools: [
        {
          id: "ct-1",
          name: "my_tool",
          description: "Broken webhook",
          parametersSchema: JSON.stringify({ type: "object", properties: {} }),
          executionType: "webhook",
          webhookUrl: "https://invalid.example/none",
          staticResult: null,
          enabled: true,
        },
      ],
      script: { turns },
      customToolExecuteImpl: async () => {
        throw new Error("webhook unreachable");
      },
    });

    const events = await collectEvents(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "do it",
        impersonateBlockAgents: true,
      }),
    );

    const toolResultEvents = events.filter((event) => event.type === "tool_result");
    expect(toolResultEvents).toHaveLength(1);
    const result = toolResultEvents[0]!.data as { success: boolean; result: string; name: string };
    expect(result.success).toBe(false);
    expect(result.name).toBe("my_tool");
    expect(result.result.length).toBeGreaterThan(0);

    const doneEvent = events.find((event) => event.type === "done");
    expect(doneEvent).toBeTruthy();
  });
});

// ──────────────────────────────────────────────
// Row 4 — Tool turns NOT persisted as chat messages
// ──────────────────────────────────────────────

describe("row 4 — tool-call/tool-result turns are NOT persisted as chat messages", () => {
  it("only persists role=user and role=assistant; never role=tool", async () => {
    const turns: LlmChunk[][] = [
      [{ type: "token", text: "rolling..." }, toolCallChunk("roll_dice", { notation: "1d4" })],
      [{ type: "token", text: "you rolled. final answer." }],
    ];
    const { deps, createChatMessage } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: ["roll_dice"] },
      script: { turns },
    });

    await collectEvents(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "roll",
        impersonateBlockAgents: true,
      }),
    );

    const calls = createChatMessage.mock.calls;
    const persistedRoles = calls.map(([, value]) => (value as { role: string }).role);
    expect(persistedRoles).toEqual(["user", "assistant"]);
    expect(persistedRoles).not.toContain("tool");
    const assistantCall = calls.find(([, value]) => (value as { role: string }).role === "assistant");
    expect((assistantCall![1] as { content: string }).content).toBe("rolling...you rolled. final answer.");
  });
});

// ──────────────────────────────────────────────
// Row 5 — enableTools: false produces tools-undefined request + zero tool events
// ──────────────────────────────────────────────

describe("row 5 — enableTools: false → tools field is undefined and no tool events fire", () => {
  it("LlmRequest.tools is undefined and stream contains no tool_call / tool_result events", async () => {
    const turns: LlmChunk[][] = [
      [
        { type: "token", text: "hello" },
        // Even if the model emits a tool_call chunk, with mainTools=null it must NOT propagate
        toolCallChunk("roll_dice", { notation: "1d6" }),
      ],
    ];
    const { deps, streamedRequests } = makeStubDeps({
      chatMetadata: { enableTools: false },
      script: { turns },
    });
    const events = await collectEvents(
      startGeneration(deps, {
        chatId: "chat-1",
        userMessage: "hi",
        impersonateBlockAgents: true,
      }),
    );

    expect(streamedRequests).toHaveLength(1);
    expect(streamedRequests[0]!.tools).toBeUndefined();
    expect(events.find((event) => event.type === "tool_call")).toBeUndefined();
    expect(events.find((event) => event.type === "tool_result")).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// Row 6 — Agent-only tools filtered from main toolDefs
// ──────────────────────────────────────────────

describe("row 6 — agent-only tool names filtered from main toolDefs", () => {
  it("returns null when only agent-only tools are requested", async () => {
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: ["read_chat_summary"] },
      script: { turns: [[{ type: "token", text: "ok" }]] },
    });
    const built = await buildMainToolDefinitions({
      chat: { id: "chat-1", metadata: { enableTools: true, activeToolIds: ["read_chat_summary"] } },
      storage: deps.storage,
      integrations: deps.integrations,
    });
    expect(built).toBeNull();
  });

  it("with activeToolIds: [] all four agent-only names are excluded", async () => {
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: [] },
      script: { turns: [[{ type: "token", text: "ok" }]] },
    });
    const built = await buildMainToolDefinitions({
      chat: { id: "chat-1", metadata: { enableTools: true, activeToolIds: [] } },
      storage: deps.storage,
      integrations: deps.integrations,
    });
    expect(built).not.toBeNull();
    const names = built!.toolDefs.map((tool) => tool.name);
    expect(names).not.toContain("read_chat_summary");
    expect(names).not.toContain("append_chat_summary");
    expect(names).not.toContain("read_chat_variable");
    expect(names).not.toContain("write_chat_variable");
  });
});

// ──────────────────────────────────────────────
// Row 7 — activeToolIds: [] + enableTools: true exposes all built-ins minus agent-only minus spotify, plus customs
// ──────────────────────────────────────────────

describe("row 7 — empty activeToolIds with enableTools: true exposes the expected set", () => {
  it("includes all built-ins except agent-only + spotify, and includes enabled customs", async () => {
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: [] },
      customTools: [
        {
          id: "ct-1",
          name: "weather_lookup",
          description: "Returns the weather.",
          parametersSchema: JSON.stringify({ type: "object", properties: {} }),
          executionType: "static",
          webhookUrl: null,
          staticResult: "sunny",
          enabled: true,
        },
        {
          id: "ct-2",
          name: "disabled_one",
          description: "Should not appear",
          parametersSchema: JSON.stringify({ type: "object", properties: {} }),
          executionType: "static",
          webhookUrl: null,
          staticResult: "x",
          enabled: false,
        },
      ],
      script: { turns: [[{ type: "token", text: "ok" }]] },
    });
    const built = await buildMainToolDefinitions({
      chat: { id: "chat-1", metadata: { enableTools: true, activeToolIds: [] } },
      storage: deps.storage,
      integrations: deps.integrations,
    });
    expect(built).not.toBeNull();
    const names = new Set(built!.toolDefs.map((tool) => tool.name));
    // Expected built-ins on the main path:
    expect(names).toContain("roll_dice");
    expect(names).toContain("update_game_state");
    expect(names).toContain("set_expression");
    expect(names).toContain("trigger_event");
    expect(names).toContain("search_lorebook");
    // Agent-only must be absent:
    for (const agentOnly of [
      "read_chat_summary",
      "append_chat_summary",
      "read_chat_variable",
      "write_chat_variable",
    ]) {
      expect(names.has(agentOnly)).toBe(false);
    }
    // Spotify must be absent on the main path:
    for (const spotify of [
      "spotify_get_current_playback",
      "spotify_get_playlists",
      "spotify_get_playlist_tracks",
      "spotify_search",
      "spotify_play",
      "spotify_set_volume",
    ]) {
      expect(names.has(spotify)).toBe(false);
    }
    // Enabled custom appears, disabled custom does not:
    expect(names.has("weather_lookup")).toBe(true);
    expect(names.has("disabled_one")).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Row 8 — Mid-loop abort propagates cleanly, no orphan tool_call without tool_result
// ──────────────────────────────────────────────

describe("row 8 — mid-loop abort propagates cleanly", () => {
  it("aborting between turns terminates the loop with matched tool_call/tool_result pairs only", async () => {
    const controller = new AbortController();

    // Stub stream so that the FIRST turn yields a tool_call and the SECOND turn,
    // when entered, throws an AbortError because the signal has been triggered
    // by the consumer's executeMainToolCall path. We simulate the signal-triggered
    // pre-yield by checking signal.aborted at the top of each stream() call.
    let callCount = 0;
    const turns: LlmChunk[][] = [
      [{ type: "token", text: "rolling..." }, toolCallChunk("roll_dice", { notation: "1d4" })],
      [{ type: "token", text: "should-never-reach" }],
    ];

    const stubChat: Record<string, unknown> = {
      id: "chat-1",
      mode: "conversation",
      connectionId: "connection-1",
      characterIds: [],
      metadata: { enableTools: true, activeToolIds: ["roll_dice"] },
    };
    const connection = { id: "connection-1", model: "test-model", defaultParameters: {} };
    const allMessages: Array<Record<string, unknown>> = [
      { id: "assistant-1", chatId: "chat-1", role: "assistant", content: "?" },
    ];
    const messagesById = new Map(allMessages.map((message) => [String(message.id), message]));

    const createChatMessage = vi.fn(async (_chatId: string, value: Record<string, unknown>) => {
      const id = value.role === "user" ? "user-1" : "assistant-2";
      const saved = { id, chatId: "chat-1", ...value };
      allMessages.push(saved);
      messagesById.set(id, saved);
      return saved;
    });
    const stream: LlmGateway["stream"] = vi.fn(async function* (_request, signal) {
      callCount++;
      if (signal?.aborted) {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }
      // After yielding the first turn, abort BEFORE we even enter the second.
      const chunks = turns[callCount - 1] ?? [];
      for (const chunk of chunks) {
        yield chunk;
      }
      // Trigger abort once the first turn has fully yielded its chunks.
      if (callCount === 1) controller.abort();
    });
    const storage: StorageGateway = {
      get: vi.fn(async (entity: string, id: string) => {
        if (entity === "chats" && id === "chat-1") return stubChat;
        if (entity === "connections" && id === "connection-1") return connection;
        if (entity === "messages") return messagesById.get(id) ?? null;
        return null;
      }),
      list: vi.fn(async () => []),
      create: vi.fn(async (_entity: string, value: Record<string, unknown>) => value),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({ deleted: true })),
      listChatMessages: vi.fn(async () => [...allMessages]),
      createChatMessage,
      updateChatMessage: vi.fn(async () => ({})),
      deleteChatMessage: vi.fn(async () => ({ deleted: true })),
      patchChatMessageExtra: vi.fn(async () => ({})),
      addChatMessageSwipe: vi.fn(async () => ({})),
      patchChatMetadata: vi.fn(async () => ({})),
      patchChatSummaries: vi.fn(async () => ({})),
      listChatMemories: vi.fn(async () => []),
      getWorldState: vi.fn(async () => null),
      saveTrackerSnapshot: vi.fn(async (_chatId: string, snapshot: Record<string, unknown>) => snapshot),
      listLorebookEntries: vi.fn(async () => []),
      createLorebookEntries: vi.fn(async () => []),
      promptFull: vi.fn(async () => null),
    } as StorageGateway;
    const integrations: IntegrationGateway = {
      customTools: { execute: vi.fn(async () => ({})) },
      spotify: {
        player: vi.fn(),
        playlists: vi.fn(),
        playlistTracks: vi.fn(),
        searchTracks: vi.fn(),
        playTrack: vi.fn(),
        play: vi.fn(),
        volume: vi.fn(),
      },
      haptic: { command: vi.fn(), stopAll: vi.fn() },
      image: { generate: vi.fn() },
    } as IntegrationGateway;
    const llm: LlmGateway = {
      stream,
      complete: vi.fn(async () => ""),
      listModels: vi.fn(async () => []),
    };
    const deps: GenerationEngineDeps = { storage, llm, integrations };

    const events: CollectedEvent[] = [];
    let threw: unknown = null;
    try {
      for await (const event of startGeneration(
        deps,
        { chatId: "chat-1", userMessage: "roll", impersonateBlockAgents: true },
        controller.signal,
      )) {
        events.push({ type: event.type, data: event.data });
      }
    } catch (err) {
      threw = err;
    }

    // Every emitted tool_call must have a matching tool_result by id.
    const toolCalls = events.filter((event) => event.type === "tool_call");
    const toolResults = events.filter((event) => event.type === "tool_result");
    expect(toolCalls.length).toBe(toolResults.length);
    const callIds = new Set(
      toolCalls.map((event) => (event.data as { id: string }).id),
    );
    for (const result of toolResults) {
      expect(callIds.has((result.data as { toolCallId: string }).toolCallId)).toBe(true);
    }
    // Aborts may surface as a thrown error from the second stream() call — that's fine.
    // What matters is no orphan tool_call without a tool_result.
    expect(callCount).toBeGreaterThanOrEqual(1);
    // Suppress unused-binding warning on `threw` (recorded for diagnostic clarity).
    expect(threw === null || threw instanceof Error).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Row 9 — Branch B (directMessages) tool loop matches Branch A behavior
// ──────────────────────────────────────────────

describe("row 9 — Branch B (directMessages) tool loop matches Branch A behavior", () => {
  it("directMessages path runs the same multi-turn tool loop and caps at 8 iterations", async () => {
    // 10 turns of repeated roll_dice with directMessages — should also cap at 8.
    const turn: LlmChunk[] = [
      { type: "token", text: "x" },
      toolCallChunk("roll_dice", { notation: "1d6" }),
    ];
    const turns: LlmChunk[][] = Array.from({ length: 10 }, () => turn);
    const { deps, streamedRequests } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: ["roll_dice"] },
      script: { turns },
    });
    const events = await collectEvents(
      startGeneration(deps, {
        chatId: "chat-1",
        messages: [{ role: "user", content: "direct prompt" }],
        impersonate: true,
      }),
    );
    expect(streamedRequests).toHaveLength(8);
    const capPhase = events.find(
      (event) =>
        event.type === "phase" &&
        typeof event.data === "string" &&
        event.data.includes("Tool-call iteration limit (8)"),
    );
    expect(capPhase).toBeTruthy();

    // Tool definitions were also passed on the directMessages stream.
    expect(streamedRequests[0]!.tools).toBeDefined();
    expect(streamedRequests[0]!.tools!.map((tool) => tool.name)).toContain("roll_dice");
  });
});

// ──────────────────────────────────────────────
// Row 10 — Custom-tool name collision with built-in: built-in wins, no duplicate
// ──────────────────────────────────────────────

describe("row 10 — custom-tool name collision with built-in: built-in wins, no duplicate", () => {
  it("toolDefs contains exactly one roll_dice entry when a custom roll_dice is also enabled", async () => {
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: [] },
      customTools: [
        {
          id: "ct-collide",
          name: "roll_dice",
          description: "fake roll_dice",
          parametersSchema: JSON.stringify({ type: "object", properties: {} }),
          executionType: "static",
          webhookUrl: null,
          staticResult: "fake",
          enabled: true,
        },
      ],
      script: { turns: [[{ type: "token", text: "ok" }]] },
    });
    const built = await buildMainToolDefinitions({
      chat: { id: "chat-1", metadata: { enableTools: true, activeToolIds: [] } },
      storage: deps.storage,
      integrations: deps.integrations,
    });
    expect(built).not.toBeNull();
    const rollDiceEntries = built!.toolDefs.filter((tool) => tool.name === "roll_dice");
    expect(rollDiceEntries).toHaveLength(1);
    // And the entry retained is the built-in (its description starts with "Roll dice using ...")
    expect(rollDiceEntries[0]!.description).toMatch(/Roll dice/i);
  });

  it("executeMainToolCall dispatches to the built-in (not custom) on name collision", async () => {
    const customTools = new Map<string, CustomToolRecord>([
      [
        "roll_dice",
        {
          id: "ct-collide",
          name: "roll_dice",
          description: "fake",
          parametersSchema: { type: "object", properties: {} },
          executionType: "static",
          webhookUrl: null,
          staticResult: "fake",
          enabled: true,
        } as CustomToolRecord,
      ],
    ]);
    const customExecute = vi.fn(async () => ({ from: "custom" }));
    const storage = {
      get: vi.fn(async () => null),
      list: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    } as unknown as StorageGateway;
    const integrations = {
      customTools: { execute: customExecute },
      spotify: {} as IntegrationGateway["spotify"],
      haptic: {} as IntegrationGateway["haptic"],
      image: {} as IntegrationGateway["image"],
    } as IntegrationGateway;

    const result = await executeMainToolCall({
      deps: { storage, integrations },
      input: {
        chat: { id: "chat-1", metadata: {} },
        activatedLorebookEntries: [],
        chatSummary: null,
      },
      customTools,
      allowedToolNames: new Set(["roll_dice"]),
      call: {
        id: "call-1",
        name: "roll_dice",
        arguments: JSON.stringify({ notation: "1d6" }),
        function: { name: "roll_dice", arguments: JSON.stringify({ notation: "1d6" }) },
      },
    });

    // Custom executor was NOT called — built-in handled it.
    expect(customExecute).not.toHaveBeenCalled();
    // The built-in roll_dice returns a JSON-stringified object with notation/rolls/total/reason.
    const parsed = JSON.parse(result) as { notation: string; rolls: number[]; total: number };
    expect(parsed.notation).toMatch(/^1d6/);
    expect(parsed.rolls).toHaveLength(1);
    expect(typeof parsed.total).toBe("number");
  });

  it("executeMainToolCall rejects tools that were filtered out of toolDefs (allowlist enforcement)", async () => {
    // The model hallucinates a call to spotify_play, which buildMainToolDefinitions
    // had filtered out. executeMainToolCall must reject it without dispatching.
    const customExecute = vi.fn(async () => ({ ok: true }));
    const storage = {
      get: vi.fn(async () => null),
      list: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    } as unknown as StorageGateway;
    const integrations = {
      customTools: { execute: customExecute },
      spotify: {
        player: vi.fn(async () => ({ playing: true })),
      } as unknown as IntegrationGateway["spotify"],
      haptic: {} as IntegrationGateway["haptic"],
      image: {} as IntegrationGateway["image"],
    } as IntegrationGateway;

    const result = await executeMainToolCall({
      deps: { storage, integrations },
      input: {
        chat: { id: "chat-1", metadata: {} },
        activatedLorebookEntries: [],
        chatSummary: null,
      },
      customTools: new Map(),
      allowedToolNames: new Set(["roll_dice"]), // spotify_play NOT in allowlist
      call: {
        id: "call-1",
        name: "spotify_play",
        arguments: JSON.stringify({ uri: "spotify:track:abc" }),
        function: { name: "spotify_play", arguments: JSON.stringify({ uri: "spotify:track:abc" }) },
      },
    });

    expect(customExecute).not.toHaveBeenCalled();
    expect((integrations.spotify as unknown as { player: ReturnType<typeof vi.fn> }).player).not.toHaveBeenCalled();
    const parsed = JSON.parse(result) as { error: string };
    expect(parsed.error).toContain("Tool not enabled for this chat");
    expect(parsed.error).toContain("spotify_play");
  });

  it("normalizeToolCall preserves object-form arguments instead of coercing to '{}'", async () => {
    // Some providers emit pre-parsed arguments as an object rather than a JSON string.
    // The pre-fix readString coercion would collapse the object to "{}", silently
    // erasing required fields and failing downstream tool execution.
    const objectArgsCall = normalizeToolCall({
      id: "call-obj",
      function: { name: "roll_dice", arguments: { notation: "2d6", reason: "perception" } },
    });
    expect(objectArgsCall).not.toBeNull();
    const parsed = JSON.parse(objectArgsCall!.arguments) as { notation: string; reason: string };
    expect(parsed.notation).toBe("2d6");
    expect(parsed.reason).toBe("perception");

    // String form still passes through unchanged.
    const stringArgsCall = normalizeToolCall({
      id: "call-str",
      function: { name: "roll_dice", arguments: JSON.stringify({ notation: "1d20" }) },
    });
    expect(stringArgsCall).not.toBeNull();
    expect(stringArgsCall!.arguments).toBe(JSON.stringify({ notation: "1d20" }));

    // Missing arguments fall back to empty object literal.
    const noArgsCall = normalizeToolCall({ id: "call-none", function: { name: "roll_dice" } });
    expect(noArgsCall).not.toBeNull();
    expect(noArgsCall!.arguments).toBe("{}");
  });

  it("script custom tools are exposed to the LLM when the Tauri TypeScript runtime can execute them", async () => {
    // Profile imports can leave script-type custom-tool rows on disk. The Tauri
    // Rust storage layer preserves those rows, while the TypeScript generation
    // runtime executes script tools locally.
    const { deps } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: [] },
      customTools: [
        {
          id: "ct-legacy",
          name: "legacy_calc",
          description: "old script tool",
          parametersSchema: JSON.stringify({ type: "object", properties: {} }),
          executionType: "script",
          webhookUrl: null,
          staticResult: null,
          scriptBody: "return arguments.a + arguments.b;",
          enabled: true,
        },
      ],
      script: { turns: [[{ type: "token", text: "ok" }]] },
    });
    const built = await buildMainToolDefinitions({
      chat: { id: "chat-1", metadata: { enableTools: true, activeToolIds: [] } },
      storage: deps.storage,
      integrations: deps.integrations,
    });
    expect(built).not.toBeNull();
    const names = built!.toolDefs.map((tool) => tool.name);
    expect(names).toContain("legacy_calc");
  });

  it("usage is aggregated across multi-turn tool-call loops, not overwritten by the last turn", async () => {
    // Two-turn loop: turn 1 emits usage A + a tool call, turn 2 emits usage B
    // and resolves. Saved usage must reflect both turns' token counts.
    const { deps, createChatMessage } = makeStubDeps({
      chatMetadata: { enableTools: true, activeToolIds: ["roll_dice"] },
      script: {
        turns: [
          [
            { type: "token", text: "thinking..." },
            toolCallChunk("roll_dice", { notation: "1d6" }, "c1"),
            { type: "usage", data: { promptTokens: 100, completionTokens: 20, totalTokens: 120 } },
          ],
          [
            { type: "token", text: " result is 4." },
            { type: "usage", data: { promptTokens: 150, completionTokens: 30, totalTokens: 180 } },
          ],
        ],
      },
    });

    await collectEvents(startGeneration(deps, { chatId: "chat-1", message: "go" }));

    const assistantCall = createChatMessage.mock.calls.find(([, body]) => (body as Record<string, unknown>).role === "assistant");
    expect(assistantCall).toBeDefined();
    const generationInfo = (assistantCall![1] as { generationInfo: { usage: Record<string, number> } }).generationInfo;
    expect(generationInfo.usage.promptTokens).toBe(250);
    expect(generationInfo.usage.completionTokens).toBe(50);
    expect(generationInfo.usage.totalTokens).toBe(300);
  });
});
