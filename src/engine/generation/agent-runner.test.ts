import { describe, expect, it } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { createGenerationAgentRuntime } from "./agent-runner";

function storageWithAgentRuns(agentRuns: unknown[]): StorageGateway {
  const agents = [
    {
      id: "director",
      type: "director",
      name: "Narrative Director",
      enabled: true,
      phase: "pre_generation",
      settings: { runInterval: 5 },
    },
  ];
  const connections = [{ id: "conn-1", provider: "mock", model: "mock-model" }];
  return {
    async list(collection: string) {
      if (collection === "agents") return agents;
      if (collection === "connections") return connections;
      if (collection === "agent-runs") return agentRuns;
      if (collection === "tools") return [];
      if (collection === "lorebooks") return [];
      return [];
    },
    async get() {
      return null;
    },
    async listLorebookEntries() {
      return [];
    },
  } as unknown as StorageGateway;
}

function llmWithDirectorNote(calls: { count: number }): LlmGateway {
  return {
    async *stream() {
      calls.count += 1;
      yield { type: "token", text: "[Director's note: Take the reroll in a new direction.]" };
    },
  } as unknown as LlmGateway;
}

const integrations = {} as IntegrationGateway;
const chat = {
  id: "chat-1",
  mode: "roleplay",
  metadata: { enableAgents: true },
};
const connection = { id: "conn-1", provider: "mock", model: "mock-model" };
const storedMessages = [
  { id: "user-1", role: "user", content: "Start." },
  { id: "assistant-1", role: "assistant", content: "First guided reply." },
];

describe("createGenerationAgentRuntime regeneration cadence", () => {
  it("reruns Narrative Director when its last successful interval run is on the regenerated message", async () => {
    const calls = { count: 0 };
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storageWithAgentRuns([
          {
            chatId: "chat-1",
            messageId: "assistant-1",
            agentType: "director",
            success: true,
            createdAt: "2026-06-01T00:00:00.000Z",
          },
        ]),
        llm: llmWithDirectorNote(calls),
        integrations,
      },
      {
        chat,
        connection,
        storedMessages: storedMessages.slice(0, 1),
        cadenceMessages: storedMessages,
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
        regenerateMessageId: "assistant-1",
      },
    );

    expect(calls.count).toBe(1);
    expect(runtime.preInjections).toEqual([
      {
        agentType: "director",
        agentName: "Narrative Director",
        text: "[Director's note: Take the reroll in a new direction.]",
      },
    ]);
  });

  it("keeps normal interval suppression for older director runs during regeneration", async () => {
    const calls = { count: 0 };
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storageWithAgentRuns([
          {
            chatId: "chat-1",
            messageId: "assistant-0",
            agentType: "director",
            success: true,
            createdAt: "2026-06-01T00:00:00.000Z",
          },
        ]),
        llm: llmWithDirectorNote(calls),
        integrations,
      },
      {
        chat,
        connection,
        storedMessages: storedMessages.slice(0, 1),
        cadenceMessages: [{ id: "assistant-0", role: "assistant", content: "Earlier." }, ...storedMessages],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
        regenerateMessageId: "assistant-1",
      },
    );

    expect(calls.count).toBe(0);
    expect(runtime.preInjections).toEqual([]);
  });
});
