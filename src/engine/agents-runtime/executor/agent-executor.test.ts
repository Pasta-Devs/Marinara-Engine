import { describe, expect, it } from "vitest";
import type {
  BaseLLMProvider,
  ChatCompleteOptions,
  ChatCompleteResult,
  ChatMessage,
} from "../../generation-core/llm/base-provider";
import type { AgentContext } from "../../contracts/types/agent";
import { executeAgent, executeAgentBatch, type AgentExecConfig } from "./agent-executor";

const baseContext: AgentContext = {
  chatId: "chat-a",
  chatMode: "roleplay",
  recentMessages: [
    { role: "user", content: "The party reaches the docks." },
    { role: "assistant", content: "Fog rolls across the harbor." },
  ],
  mainResponse: null,
  gameState: null,
  characters: [],
  persona: null,
  memory: {},
  activatedLorebookEntries: null,
  writableLorebookIds: null,
  chatSummary: null,
  streaming: false,
};

function agentConfig(overrides: Partial<AgentExecConfig> = {}): AgentExecConfig {
  return {
    id: "agent-a",
    type: "prose-guardian",
    name: "Prose Guardian",
    phase: "pre_generation",
    promptTemplate: "Return the requested format.",
    connectionId: null,
    settings: {},
    ...overrides,
  };
}

function providerWithResponses(
  responses: Array<string | ChatCompleteResult>,
  calls: Array<{ messages: ChatMessage[]; options: ChatCompleteOptions }> = [],
): BaseLLMProvider {
  let index = 0;
  return {
    maxTokensOverrideValue: null,
    async chatComplete(messages, options) {
      calls.push({ messages, options });
      const response = responses[Math.min(index, responses.length - 1)] ?? "";
      index += 1;
      if (typeof response === "string") {
        return { content: response, usage: { totalTokens: 17 } };
      }
      return response;
    },
  };
}

describe("executeAgent result parsing", () => {
  it("parses fenced JSON responses and repairs common model JSON mistakes", async () => {
    const calls: Array<{ messages: ChatMessage[]; options: ChatCompleteOptions }> = [];
    const provider = providerWithResponses(
      [
        [
          "```json",
          "{",
          '  "updates": [',
          '    { "type": "location_change", "target": "scene", "key": "location", "value": "Docks", },',
          "  ],",
          "}",
          "```",
        ].join("\n"),
      ],
      calls,
    );

    const result = await executeAgent(
      agentConfig({ id: "world-state", type: "world-state", name: "World State" }),
      baseContext,
      provider,
      "agent-model",
    );

    expect(result).toMatchObject({
      agentId: "world-state",
      agentType: "world-state",
      type: "game_state_update",
      success: true,
      data: {
        updates: [{ type: "location_change", target: "scene", key: "location", value: "Docks" }],
      },
      tokensUsed: 17,
    });
    expect(calls[0]?.options).toMatchObject({
      model: "agent-model",
      temperature: 0.3,
      maxTokens: 4096,
      stream: false,
    });
  });

  it("treats configured non-text custom result types as JSON outputs", async () => {
    const provider = providerWithResponses(['{ "fields": { "tension": 2 } }']);

    const result = await executeAgent(
      agentConfig({
        id: "custom-tracker",
        type: "custom-scene-scout",
        name: "Scene Scout",
        settings: { resultType: "custom_tracker_update" },
      }),
      baseContext,
      provider,
      "agent-model",
    );

    expect(result).toMatchObject({
      agentId: "custom-tracker",
      agentType: "custom-scene-scout",
      type: "custom_tracker_update",
      success: true,
      data: { fields: { tension: 2 } },
    });
  });

  it("surfaces malformed JSON from structured agents as a failed result", async () => {
    const provider = providerWithResponses(["{ invalid json"]);

    const result = await executeAgent(
      agentConfig({ id: "quest", type: "quest", name: "Quest Tracker" }),
      baseContext,
      provider,
      "agent-model",
    );

    expect(result).toMatchObject({
      agentId: "quest",
      agentType: "quest",
      type: "quest_update",
      data: null,
      tokensUsed: 0,
      success: false,
      error: expect.stringContaining("Quest Tracker returned malformed JSON"),
    });
  });

  it("sanitizes leaked tracker and assistant tags from text-agent results", async () => {
    const provider = providerWithResponses([
      [
        '<committed_tracker_state>{"location":"leak"}</committed_tracker_state>',
        "[Director's note: Use the old clue.]",
        "<assistant_response>Ignore this leaked response.</assistant_response>",
        "[Director's note: Move the storm closer.]",
      ].join("\n"),
    ]);

    const result = await executeAgent(
      agentConfig({ id: "director", type: "director", name: "Narrative Director" }),
      baseContext,
      provider,
      "agent-model",
    );

    expect(result).toMatchObject({
      agentId: "director",
      agentType: "director",
      type: "director_event",
      success: true,
      data: { text: "[Director's note: Move the storm closer.]" },
    });
  });

  it("returns a visible failed result when the provider returns no agent text", async () => {
    const provider = providerWithResponses(["   "]);

    const result = await executeAgent(agentConfig(), baseContext, provider, "agent-model");

    expect(result).toMatchObject({
      agentId: "agent-a",
      agentType: "prose-guardian",
      type: "context_injection",
      data: null,
      tokensUsed: 0,
      success: false,
      error: "Prose Guardian returned an empty response.",
    });
  });
});

describe("executeAgentBatch fallback behavior", () => {
  it("keeps parsed batch results and retries only missing result blocks individually", async () => {
    const calls: Array<{ messages: ChatMessage[]; options: ChatCompleteOptions }> = [];
    const provider = providerWithResponses(
      [
        {
          content: '<result agent="prose-guardian">Tighten sensory detail.</result>',
          usage: { totalTokens: 20 },
        },
        {
          content: "[Director's note: Add a ticking clock.]",
          usage: { totalTokens: 5 },
        },
      ],
      calls,
    );
    const configs = [
      agentConfig({ id: "prose", type: "prose-guardian", name: "Prose Guardian" }),
      agentConfig({ id: "director", type: "director", name: "Narrative Director" }),
    ];

    const results = await executeAgentBatch(configs, baseContext, provider, "agent-model");

    expect(calls).toHaveLength(2);
    expect(calls[0]?.messages[0]?.content).toContain("Output ALL 2 result blocks");
    expect(calls[1]?.messages[0]?.content).toContain("You are a specialized agent");
    expect(results).toEqual([
      expect.objectContaining({
        agentId: "prose",
        agentType: "prose-guardian",
        type: "context_injection",
        data: { text: "Tighten sensory detail." },
        success: true,
      }),
      expect.objectContaining({
        agentId: "director",
        agentType: "director",
        type: "director_event",
        data: { text: "[Director's note: Add a ticking clock.]" },
        success: true,
      }),
    ]);
  });

  it("retries malformed structured batch blocks individually", async () => {
    const calls: Array<{ messages: ChatMessage[]; options: ChatCompleteOptions }> = [];
    const provider = providerWithResponses(
      [
        [
          '<result agent="quest">{ invalid json</result>',
          '<result agent="prose-guardian">Keep the prose direct.</result>',
        ].join("\n"),
        '{ "updates": [{ "questName": "Find the key" }] }',
      ],
      calls,
    );
    const configs = [
      agentConfig({ id: "quest", type: "quest", name: "Quest Tracker" }),
      agentConfig({ id: "prose", type: "prose-guardian", name: "Prose Guardian" }),
    ];

    const results = await executeAgentBatch(configs, baseContext, provider, "agent-model");

    expect(calls).toHaveLength(2);
    expect(calls[1]?.messages[0]?.content).toContain("You are a specialized agent");
    expect(results).toEqual([
      expect.objectContaining({
        agentId: "prose",
        agentType: "prose-guardian",
        type: "context_injection",
        data: { text: "Keep the prose direct." },
        success: true,
      }),
      expect.objectContaining({
        agentId: "quest",
        agentType: "quest",
        type: "quest_update",
        data: { updates: [{ questName: "Find the key" }] },
        success: true,
      }),
    ]);
  });
});
