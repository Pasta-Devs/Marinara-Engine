import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BaseLLMProvider,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import type { AgentContext, AgentResult } from "../../packages/shared/src/types/agent.js";
import { previousAgentOutputText, publicAgentOutput } from "../../packages/shared/src/utils/agent-output.js";

assert.equal(previousAgentOutputText({ text: "public", "agent-context": null }), "");
assert.equal(previousAgentOutputText({ text: "legacy text" }), "legacy text");
assert.equal(previousAgentOutputText({ value: 3, "agent-context": { counter: 2 } }), '{"counter":2}');
assert.deepEqual(publicAgentOutput({ text: "public", "agent-context": "secret", agentContext: "alias" }), {
  text: "public",
});

const dataDir = mkdtempSync(join(tmpdir(), "marinara-agent-context-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { executeAgentBatch } = await import("../../packages/server/src/services/agents/agent-executor.js");
const { expandMarker } = await import("../../packages/server/src/services/prompt/marker-expander.js");
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
class Provider extends BaseLLMProvider {
  prompts: string[] = [];
  constructor() {
    super("http://localhost", "");
  }
  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string> {
    return;
  }
  override async chatComplete(messages: ChatMessage[]) {
    const prompt = messages.map((message) => message.content).join("\n");
    this.prompts.push(prompt);
    return {
      content: JSON.stringify({ text: "PUBLIC", "agent-context": "NEXT_SECRET" }),
      toolCalls: [],
      finishReason: "stop" as const,
    };
  }
}
try {
  const chat = await chats.create({ name: "Context regression", mode: "roleplay", characterIds: [] });
  assert.ok(chat);
  const configs = await Promise.all(
    ["a", "b"].map((suffix) =>
      agents.create({
        type: `custom-memory-${suffix}`,
        name: suffix,
        phase: "pre_generation",
        promptTemplate: `Prior: {{agent::custom-memory-${suffix}}}`,
        settings: {
          contextSources: { previousOutput: true },
          jsonContextOutput: true,
          hideOutput: true,
          resultType: "context_injection",
        },
      }),
    ),
  );
  const rows = [];
  for (let i = 0; i < 3; i++)
    rows.push(await chats.createMessage({ chatId: chat.id, role: "assistant", content: `Turn ${i}` }));
  const [first, second, third] = rows;
  assert.ok(first && second && third);
  const save = (config: (typeof configs)[number], messageId: string, secret: string) =>
    agents.saveRun({
      agentConfigId: config!.id,
      chatId: chat.id,
      messageId,
      result: {
        agentId: config!.id,
        agentType: config!.type,
        type: "context_injection",
        data: { text: "PUBLIC", "agent-context": secret },
        tokensUsed: 1,
        durationMs: 1,
        success: true,
        error: null,
      } as AgentResult,
    });
  await save(configs[0], first.id, "SECRET_A");
  await save(configs[1], first.id, "SECRET_B");
  await save(configs[0], second.id, "SECRET_NEWER");
  await save(configs[0], first.id, "SECRET_A"); // manual historical rerun must not become the latest turn
  assert.equal(
    ((await agents.getPreviousOutput(configs[0]!.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_NEWER",
  );
  const provider = new Provider();
  const context: AgentContext = {
    chatId: chat.id,
    chatMode: "roleplay",
    recentMessages: [],
    mainResponse: null,
    gameState: null,
    characters: [],
    persona: null,
    memory: {},
    writableLorebookIds: null,
    chatSummary: null,
    streaming: false,
    loadPreviousOutput: (id) => agents.getPreviousOutput(id, chat.id, second.id, second.id),
  };
  const results = await executeAgentBatch(
    configs.map((config) => ({ ...config!, settings: JSON.parse(config!.settings), isCustomAgent: true })),
    context,
    provider,
    "mock",
  );
  assert.ok(results.every((result) => result.success));
  assert.equal(provider.prompts.length, 2, "Private-context agents must not share a batch prompt");
  assert.ok(provider.prompts.some((prompt) => prompt.includes("SECRET_A") && !prompt.includes("SECRET_B")));
  assert.ok(provider.prompts.some((prompt) => prompt.includes("SECRET_B") && !prompt.includes("SECRET_A")));
  assert.ok(
    provider.prompts.every((prompt) => !prompt.includes("SECRET_NEWER")),
    "Regeneration excludes current and future output",
  );
  assert.equal((results[0]!.data as Record<string, unknown>).text, "PUBLIC");
  assert.equal((results[0]!.data as Record<string, unknown>)["agent-context"], "NEXT_SECRET");
  const disabledProvider = new Provider();
  await executeAgentBatch(
    [
      {
        ...configs[0]!,
        settings: { resultType: "context_injection", contextSources: { previousOutput: false } },
        isCustomAgent: true,
      },
    ],
    {
      ...context,
      memory: { _agentResults: { other: { text: "Visible", "agent-context": "EDITOR_SECRET" } } },
      loadPreviousOutput: async () => {
        assert.fail("Disabled sources must not load prior output");
      },
    },
    disabledProvider,
    "mock",
  );
  assert.ok(disabledProvider.prompts.every((prompt) => !prompt.includes("SECRET")));
  const marker = await expandMarker(
    { type: "agent_data", agentType: configs[0]!.type },
    {
      db,
      chatId: chat.id,
      characterIds: [],
      personaName: "User",
      personaDescription: "",
      chatMessages: [],
      chatSummary: null,
      wrapFormat: "xml",
      enableAgents: true,
      activeAgentIds: [configs[0]!.type],
      activeLorebookIds: [],
      agentHistoryMessageId: second.id,
    },
  );
  assert.ok(marker.content.includes("PUBLIC"));
  assert.ok(!marker.content.includes("SECRET"), "Private field must not leak through main prompt markers");
  await chats.addSwipe(second.id, "Regenerated");
  assert.equal(
    ((await agents.getPreviousOutput(configs[0]!.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_A",
  );
  await save(configs[0], second.id, "SWIPE_SECRET");
  await chats.setActiveSwipe(second.id, 0);
  assert.equal(
    ((await agents.getPreviousOutput(configs[0]!.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_NEWER",
  );
  await chats.removeMessage(second.id);
  assert.equal(
    ((await agents.getPreviousOutput(configs[0]!.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_A",
  );
  assert.equal(await agents.getPreviousOutput(configs[0]!.id, "other-chat"), null);
  const customRuns = await agents.listCustomRunsForChat(chat.id);
  assert.ok(customRuns.length > 0, "Successful custom runs must remain available");
  assert.ok(customRuns.every((run) => run.hideOutput));
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("Agent own context, isolated batches, JSON output, markers, swipes, deletion and chat isolation passed.");
