import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENT_PROMPTS } from "../contracts/constants/agent-prompts";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { createGenerationAgentRuntime } from "./agent-runner";
import { assembleGenerationPrompt } from "./prompt-assembly";

type RowMap = Record<string, unknown[]>;

function storageWithRows(rows: RowMap): StorageGateway {
  return {
    list: async <T = unknown>(entity: string) => (rows[entity] ?? []) as T[],
    get: async <T = unknown>(entity: string, id: string) =>
      ((rows[entity]?.find((row) => (row as { id?: string }).id === id) ?? null) as T | null),
    create: async <T = unknown>() => ({} as T),
    update: async <T = unknown>() => ({} as T),
    delete: async () => ({ deleted: true }),
    listChatMessages: async <T = unknown>() => [] as T[],
    createChatMessage: async <T = unknown>() => ({} as T),
    updateChatMessage: async <T = unknown>() => ({} as T),
    deleteChatMessage: async () => ({ deleted: true }),
    patchChatMessageExtra: async <T = unknown>() => ({} as T),
    addChatMessageSwipe: async <T = unknown>() => ({} as T),
    patchChatMetadata: async <T = unknown>() => ({} as T),
    patchChatSummaries: async <T = unknown>() => ({} as T),
    listChatMemories: async <T = unknown>() => [] as T[],
    getWorldState: async <T = unknown>() => null as T | null,
    saveTrackerSnapshot: async <T = unknown>() => ({} as T),
    listLorebookEntries: async <T = unknown>() => [] as T[],
    createLorebookEntries: async <T = unknown>() => [] as T[],
    promptFull: async <T = unknown>() => null as T | null,
  };
}

describe("Immersive HTML agent", () => {
  it("injects the built-in HTML directive without an agent LLM call", async () => {
    const storage = storageWithRows({ agents: [] });
    const llm: LlmGateway = {
      complete: vi.fn(),
      listModels: vi.fn(async () => []),
      stream: vi.fn(async function* () {
        yield* [];
        throw new Error("Immersive HTML should not call the LLM");
      }),
    };

    const runtime = await createGenerationAgentRuntime({
      storage,
      llm,
      integrations: {} as IntegrationGateway,
    }, {
      chat: {
        id: "chat-1",
        mode: "roleplay",
        metadata: { enableAgents: true, activeAgentIds: ["html"] },
      },
      connection: {},
      storedMessages: [{ id: "m1", role: "user", content: "Show me the sign." }],
      characters: [],
      persona: null,
      activatedLorebookEntries: [],
      chatSummary: null,
    });

    expect(runtime.preInjections).toEqual([
      {
        agentType: "html",
        agentName: "Immersive HTML",
        text: DEFAULT_AGENT_PROMPTS.html,
      },
    ]);
    expect(runtime.agentData.html).toBe(DEFAULT_AGENT_PROMPTS.html);
    expect(llm.stream).not.toHaveBeenCalled();
  });

  it("adds agent instructions to prompts that do not have an agent_data marker", async () => {
    const storage = storageWithRows({
      agents: [],
      prompts: [],
      "regex-scripts": [],
      lorebooks: [],
      personas: [],
      characters: [
        {
          id: "char-1",
          name: "Ari",
          data: { name: "Ari", description: "A sign painter." },
        },
      ],
    });

    const assembly = await assembleGenerationPrompt(storage, {
      chat: {
        id: "chat-1",
        mode: "roleplay",
        characterIds: ["char-1"],
        metadata: {},
      },
      storedMessages: [{ id: "m1", role: "user", content: "Make the shop sign vivid." }],
      connection: {},
      request: {},
      latestUserInput: "Make the shop sign vivid.",
      agentData: { html: DEFAULT_AGENT_PROMPTS.html },
    });

    const promptText = assembly.messages.map((message) => message.content).join("\n\n");
    expect(promptText).toContain("<agent_instructions>");
    expect(promptText).toContain("html:");
    expect(promptText).toContain("inline HTML, CSS, and JS");
  });
});
