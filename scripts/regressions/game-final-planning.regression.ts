import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-game-final-planning-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
let outputs: string[] = [];
let calls = 0;
let instructions: string[] = [];
OpenAIProvider.prototype.chat = async function* (messages) {
  instructions.push(String(messages.at(-1)?.content ?? ""));
  const content = outputs[calls++];
  assert.notEqual(content, undefined, "no unexpected model request is needed");
  yield content!;
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2, finishReason: "stop" };
};
OpenAIProvider.prototype.chatComplete = async (messages) => {
  instructions.push(String(messages.at(-1)?.content ?? ""));
  const content = outputs[calls++];
  assert.notEqual(content, undefined, "no unexpected completion request is needed");
  return {
    content: content!,
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
};
const db = await getDB();
const chats = createChatsStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
const failures: unknown[] = [];
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Final planning fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  assert(connection);
  const run = async (
    label: string,
    replies: string[],
    mode: "game" | "roleplay" = "game",
    impersonate = false,
    userMessage = "Continue the scene.",
  ) => {
    outputs = replies;
    calls = 0;
    instructions = [];
    const chat = await chats.create({ name: label, mode, characterIds: [], connectionId: connection.id });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableTools: false,
      gameActiveState: "exploration",
      gameOneRequestDice: false,
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage, impersonate },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(calls, replies.length, `${label}: ${response.body}`);
    const events = response.body
      .split("\n\n")
      .filter((block: string) => block.startsWith("data: "))
      .map((block: string) => JSON.parse(block.slice(6)));
    // This tests the finalized stream, not a new filter for transient provider tokens.
    let finalized = "";
    for (const event of events) {
      if (event.type === "token") finalized += event.data;
      if (event.type === "content_replace") finalized = event.data;
    }
    const rows = await chats.listMessages(chat.id);
    const saved = rows.filter((row) => row.role === (impersonate ? "user" : "assistant")).at(-1);
    console.info(
      JSON.stringify({
        label,
        finalized,
        saved: saved?.content,
        calls,
        error: events.some((event) => event.type === "error"),
      }),
    );
    return { finalized, saved, events, finalInstruction: instructions.at(-1) ?? "" };
  };
  const test = async (name: string, check: () => Promise<void>) => {
    try {
      await check();
      console.info(`PASS ${name}`);
    } catch (error) {
      failures.push(error);
      console.error(`FAIL ${name}`, error);
    }
  };
  await test("planning without narration fails safely instead of saving a plan", async () => {
    const result = await run("planning-only", ["Plan: Hidden preparation only."]);
    assert.equal(result.saved?.content, undefined);
    assert.equal(result.finalized, "");
    assert(result.events.some((event) => event.type === "error"));
  });
  await test("post-roll planning is thinking while narration and the exact real receipt survive", async () => {
    const result = await run("post-roll", [
      "The stone falls. [dice: 1d1]",
      "Plan: This is hidden final planning.\n\nThe stone strikes the floor. [dice: 1d20 = 999 (999)]",
    ]);
    const expected = "The stone strikes the floor.\n[dice: 1d1 = 1 (1)]";
    assert.equal(result.saved?.content, expected);
    assert.equal(result.finalized, expected);
    assert.match(result.finalInstruction, /starting directly with the scene/);
    const extra = typeof result.saved?.extra === "string" ? JSON.parse(result.saved.extra) : result.saved?.extra;
    assert.match(extra.thinking, /Plan: This is hidden final planning/);
  });
  await test("a planning-only post-roll reply keeps real receipts and the existing missing-narration notice", async () => {
    const result = await run("post-roll-plan-only", [
      "The stone falls. [dice: 1d1]",
      "Plan: Hidden final preparation only.",
    ]);
    // The existing receipt-only fallback retains the separator before the engine's records.
    assert.equal(result.saved?.content, "\n[dice: 1d1 = 1 (1)]");
    assert.equal(result.finalized, result.saved.content);
    assert(result.events.some((event) => event.type === "game_outcome_narration_failed"));
  });
  for (const text of [
    "The guard says, 'Plan: take the bridge.'",
    "Notes: the key remains with Pip.\n\nNext steps: choose a road.",
    "Approach: bribe the guard.\n\nThe gate stands.",
    "Beats: the bell, then the gate.",
    "OOC: Plan: choose whichever road your character prefers.",
  ])
    await test(`normal prose/OOC remains: ${text.slice(0, 24)}`, async () => {
      const result = await run("ordinary", [text]);
      assert.equal(result.saved?.content, text);
      assert.equal(result.finalized, text);
    });
  for (const [mode, impersonate] of [
    ["game", true],
    ["roleplay", false],
  ] as const)
    await test(`${mode} impersonate=${impersonate} remains outside GM planning extraction`, async () => {
      const text = "Plan: take the north road.";
      const result = await run("non-GM", [text], mode, impersonate);
      assert.equal(result.saved?.content, text);
      assert.equal(result.finalized, text);
    });
  for (const [name, replies, expected] of [
    ["ordinary", ["Plan: Take the north road."], "Plan: Take the north road."],
    ["tagged", ["<think>Private preparation.</think>Plan: Take the north road."], "Plan: Take the north road."],
    [
      "post-roll",
      ["The die rolls. [dice: 1d1]", "<think>Private preparation.</think>Plan: Take the north road."],
      "Plan: Take the north road.\n[dice: 1d1 = 1 (1)]",
    ],
  ] as const)
    await test(`explicit GM-directed ${name} answer remains visible while tagged thinking stays private`, async () => {
      const result = await run("GM-directed", [...replies], "game", false, "[To the GM] What is your plan?");
      assert.equal(result.saved?.content, expected);
      assert.equal(result.finalized, expected);
      assert(!result.events.some((event) => event.type === "error"));
      if (name !== "ordinary") {
        const extra = typeof result.saved?.extra === "string" ? JSON.parse(result.saved.extra) : result.saved?.extra;
        assert.match(extra.thinking, /Private preparation/);
      }
      if (name === "post-roll") {
        assert.match(result.finalInstruction, /Rewrite your entire last out-of-character answer/);
        assert.match(result.finalInstruction, /starting directly with the answer/);
        assert.doesNotMatch(result.finalInstruction, /Narrate the consequences now|starting directly with the scene/);
      }
    });
  if (failures.length) throw new AggregateError(failures, "Final Game planning controls failed");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
