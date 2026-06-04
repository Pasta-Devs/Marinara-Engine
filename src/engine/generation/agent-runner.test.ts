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

function storageWithAgents(agents: Array<Record<string, unknown>>, agentRuns: unknown[]): StorageGateway {
  const connections = [{ id: "conn-1", provider: "mock", model: "mock-model" }];
  return {
    async list(collection: string) {
      if (collection === "agents") return agents;
      if (collection === "connections") return connections;
      if (collection === "agent-runs") return agentRuns;
      if (collection === "tools") return [];
      if (collection === "lorebooks") return [];
      if (collection === "agent-memory") return [];
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

function llmWithJsonAgentResponse(calls: { count: number }): LlmGateway {
  return {
    async *stream() {
      calls.count += 1;
      yield { type: "token", text: "{}" };
    },
  } as unknown as LlmGateway;
}

const integrations = {} as IntegrationGateway;
const chat = {
  id: "chat-1",
  mode: "roleplay",
  metadata: { activeAgentIds: ["director"] },
};
const connection = { id: "conn-1", provider: "mock", model: "mock-model" };
const storedMessages = [
  { id: "user-1", role: "user", content: "Start." },
  { id: "assistant-1", role: "assistant", content: "First guided reply." },
];
const cardCharacter = {
  id: "char-1",
  name: "Ari",
  description: "Careful observer.",
  avatarUrl: "",
  avatarFilePath: "",
  avatarFilename: "",
  personality: "",
  scenario: "",
  creatorNotes: "",
  systemPrompt: "",
  backstory: "",
  appearance: "",
  mesExample: "",
  firstMes: "",
  postHistoryInstructions: "",
  tags: [],
};

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

describe("createGenerationAgentRuntime built-in post-processing cadence", () => {
  it("skips Automated Chat Summary until enough user messages pass", async () => {
    const calls = { count: 0 };
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storageWithAgents(
          [
            {
              id: "chat-summary",
              type: "chat-summary",
              name: "Automated Chat Summary",
              enabled: true,
              phase: "post_processing",
              settings: { runInterval: 5 },
            },
          ],
          [
            {
              chatId: "chat-1",
              messageId: "user-2",
              agentType: "chat-summary",
              success: true,
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        ),
        llm: llmWithJsonAgentResponse(calls),
        integrations,
      },
      {
        chat: { ...chat, metadata: { activeAgentIds: ["chat-summary"] } },
        connection,
        storedMessages: [
          { id: "user-1", role: "user", content: "Start." },
          { id: "assistant-1", role: "assistant", content: "Opening." },
          { id: "user-2", role: "user", content: "Continue." },
          { id: "assistant-2", role: "assistant", content: "Reply." },
          { id: "user-3", role: "user", content: "Only one new user message." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: "Earlier summary.",
      },
    );

    await runtime.runPost("Latest assistant response.");

    expect(calls.count).toBe(0);
  });

  it("runs Automated Chat Summary when the user-message interval is reached", async () => {
    const calls = { count: 0 };
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storageWithAgents(
          [
            {
              id: "chat-summary",
              type: "chat-summary",
              name: "Automated Chat Summary",
              enabled: true,
              phase: "post_processing",
              settings: { runInterval: 5 },
            },
          ],
          [
            {
              chatId: "chat-1",
              messageId: "user-1",
              agentType: "chat-summary",
              success: true,
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        ),
        llm: llmWithJsonAgentResponse(calls),
        integrations,
      },
      {
        chat: { ...chat, metadata: { activeAgentIds: ["chat-summary"] } },
        connection,
        storedMessages: [
          { id: "user-1", role: "user", content: "Start." },
          { id: "assistant-1", role: "assistant", content: "Opening." },
          { id: "user-2", role: "user", content: "Beat 2." },
          { id: "assistant-2", role: "assistant", content: "Reply 2." },
          { id: "user-3", role: "user", content: "Beat 3." },
          { id: "assistant-3", role: "assistant", content: "Reply 3." },
          { id: "user-4", role: "user", content: "Beat 4." },
          { id: "assistant-4", role: "assistant", content: "Reply 4." },
          { id: "user-5", role: "user", content: "Beat 5." },
          { id: "assistant-5", role: "assistant", content: "Reply 5." },
          { id: "user-6", role: "user", content: "Beat 6." },
        ],
        characters: [],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: "Earlier summary.",
      },
    );

    await runtime.runPost("Latest assistant response.");

    expect(calls.count).toBe(1);
  });

  it("skips Card Evolution Auditor until enough assistant messages pass", async () => {
    const calls = { count: 0 };
    const runtime = await createGenerationAgentRuntime(
      {
        storage: storageWithAgents(
          [
            {
              id: "card-evolution-auditor",
              type: "card-evolution-auditor",
              name: "Card Evolution Auditor",
              enabled: true,
              phase: "post_processing",
              settings: { runInterval: 8 },
            },
          ],
          [
            {
              chatId: "chat-1",
              messageId: "assistant-1",
              agentType: "card-evolution-auditor",
              success: true,
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        ),
        llm: llmWithJsonAgentResponse(calls),
        integrations,
      },
      {
        chat: { ...chat, metadata: { activeAgentIds: ["card-evolution-auditor"] } },
        connection,
        storedMessages: [
          { id: "user-1", role: "user", content: "Start." },
          { id: "assistant-1", role: "assistant", content: "Opening." },
          { id: "user-2", role: "user", content: "Continue." },
          { id: "assistant-2", role: "assistant", content: "Only one new assistant message." },
        ],
        characters: [cardCharacter],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    await runtime.runPost("Latest assistant response.");

    expect(calls.count).toBe(0);
  });

  it("runs Card Evolution Auditor when the assistant-message interval is reached by the pending response", async () => {
    const calls = { count: 0 };
    const messages = [
      { id: "user-1", role: "user", content: "Start." },
      { id: "assistant-1", role: "assistant", content: "Opening." },
    ];
    for (let index = 2; index <= 8; index += 1) {
      messages.push(
        { id: `user-${index}`, role: "user", content: `Beat ${index}.` },
        { id: `assistant-${index}`, role: "assistant", content: `Reply ${index}.` },
      );
    }

    const runtime = await createGenerationAgentRuntime(
      {
        storage: storageWithAgents(
          [
            {
              id: "card-evolution-auditor",
              type: "card-evolution-auditor",
              name: "Card Evolution Auditor",
              enabled: true,
              phase: "post_processing",
              settings: { runInterval: 8 },
            },
          ],
          [
            {
              chatId: "chat-1",
              messageId: "assistant-1",
              agentType: "card-evolution-auditor",
              success: true,
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        ),
        llm: llmWithJsonAgentResponse(calls),
        integrations,
      },
      {
        chat: { ...chat, metadata: { activeAgentIds: ["card-evolution-auditor"] } },
        connection,
        storedMessages: messages,
        characters: [cardCharacter],
        persona: null,
        activatedLorebookEntries: [],
        chatSummary: null,
      },
    );

    await runtime.runPost("Latest assistant response.");

    expect(calls.count).toBe(1);
  });
});
