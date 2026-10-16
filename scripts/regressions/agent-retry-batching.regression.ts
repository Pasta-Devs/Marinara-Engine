import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-retry-batching-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");

const ORIGINAL = "The air smelled of ozone. He drew his gold sword.";
const rewriteAgent = (id: string, name: string, defaultPromptTemplate: string) => ({
  id,
  name,
  description: "Regression fixture",
  category: "writer" as const,
  phase: "post_processing" as const,
  enabledByDefault: false,
  defaultPromptTemplate,
});
replaceBuiltInAgentDefinitions([
  rewriteAgent("prose-guardian", "Prose Guardian", "STYLE_FIXTURE"),
  rewriteAgent("continuity", "Continuity Checker", "CONTINUITY_FIXTURE"),
  {
    id: "director",
    name: "Narrative Director",
    description: "Regression fixture",
    category: "misc" as const,
    phase: "pre_generation" as const,
    enabledByDefault: false,
    defaultPromptTemplate: "DIRECTOR_FIXTURE",
  },
]);

const completion = {
  toolCalls: [],
  finishReason: "stop",
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};
const prompts: string[] = [];
let active = 0;
let peak = 0;
OpenAIProvider.prototype.chatComplete = async (messages) => {
  const prompt = messages.map((message) => String(message.content)).join("\n");
  prompts.push(prompt);
  active++;
  peak = Math.max(peak, active);
  try {
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (prompt.includes("SECRET_PLOT_FIXTURE") || prompt.includes("preserve its core mystery")) {
      return {
        content: JSON.stringify({ overarchingArc: { description: "A fixture arc.", completed: false } }),
        ...completion,
      };
    }
    if (!prompt.includes("STYLE_FIXTURE") && !prompt.includes("CONTINUITY_FIXTURE")) {
      return { content: JSON.stringify({ "notes-a": "A", "notes-b": "B", "notes-solo": "S" }), ...completion };
    }
    // An editor keeps the edits already in the reply it is given and adds its own.
    let text = ORIGINAL;
    if (prompt.includes("STYLE_FIXTURE") || prompt.includes("petrichor. He drew")) {
      text = text.replace("ozone", "petrichor");
    }
    if (prompt.includes("CONTINUITY_FIXTURE") || prompt.includes("his silver sword")) {
      text = text.replace("gold", "silver");
    }
    return {
      content: JSON.stringify({ editNeeded: true, editedText: text, changes: [{ description: "Fixture edit" }] }),
      ...completion,
    };
  } finally {
    active--;
  }
};

const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await connections.create({
    name: "Local agents",
    provider: "openai",
    model: "agent-model",
    apiKey: "fixture",
    maxContext: 32768,
    maxParallelJobs: 1,
  });
  const createAgent = (type: string, promptTemplate: string, settings: Record<string, unknown> = {}) =>
    agents.create({
      type,
      name: type,
      phase: "post_processing",
      connectionId: connection.id,
      promptTemplate,
      settings,
    });
  const retry = async (agentTypes: string[], extraPayload: Record<string, unknown> = {}) => {
    const chat = await chats.create({ name: "Retry", mode: "roleplay", characterIds: [], connectionId: connection.id });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: agentTypes, enableTools: false });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Describe the storm." });
    const reply = await chats.createMessage({ chatId: chat.id, role: "assistant", content: ORIGINAL });
    prompts.length = 0;
    peak = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: {
        chatId: chat.id,
        agentTypes,
        ...extraPayload,
        ...(extraPayload.secretPlotRerollMode ? { forMessageId: reply!.id } : {}),
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    return (await chats.getMessage(reply!.id))?.content;
  };

  // #6977: retried rewrite agents edit the reply in turn, as after a fresh reply, so no edit is lost.
  await createAgent("prose-guardian", "STYLE_FIXTURE");
  const continuity = await createAgent("continuity", "CONTINUITY_FIXTURE");
  assert.ok(continuity);
  for (const settings of [{}, { batchWithOtherAgents: false }]) {
    await agents.update(continuity.id, { settings });
    const content = await retry(["prose-guardian", "continuity"]);
    assert.equal(prompts.length, "batchWithOtherAgents" in settings ? 2 : 1);
    assert.equal(content, "The air smelled of petrichor. He drew his silver sword.", "both agents' edits are kept");
  }

  // #6977: an agent with its own request still waits for the connection's Max Parallel Agent Jobs.
  await createAgent("notes-a", "notes-a prompt", { resultType: "context_injection" });
  await createAgent("notes-solo", "notes-solo prompt", {
    resultType: "context_injection",
    batchWithOtherAgents: false,
  });
  await createAgent("notes-b", "notes-b prompt", { resultType: "context_injection" });
  await retry(["notes-a", "notes-solo", "notes-b"]);
  assert.equal(prompts.length, 2, "the opted-out agent gets its own request beside the shared one");
  assert.equal(peak, 1, "agent retries keep to the connection's Max Parallel Agent Jobs");

  // #7655: Regenerate in the Secret Plot panel uses the Director's own Secret Plot prompt.
  await createAgent("director", "DIRECTOR_FIXTURE", {
    secretPlotEnabled: true,
    secretPlotPromptTemplate: "SECRET_PLOT_FIXTURE: keep the arc about the relationship.",
  });
  await retry(["director"], { secretPlotRerollMode: "full" });
  assert.ok(
    prompts.some((prompt) => prompt.includes("SECRET_PLOT_FIXTURE")),
    "the Secret Plot reroll sends the Director's custom Secret Plot prompt",
  );
  assert.ok(
    !prompts.some((prompt) => prompt.includes("preserve its core mystery")),
    "the Secret Plot reroll does not fall back to the built-in prompt",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.info("Agent retries run rewrite agents in turn and keep to the connection's Max Parallel Agent Jobs.");
