import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONVERSATION_SCHEDULE_DAYS, type WeekSchedule } from "../../packages/shared/src/index.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-schedule-generation-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { conversationRoutes } = await import("../../packages/server/src/routes/conversation.routes.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const requests: Array<{ model: string; messages: Array<{ content: string }> }> = [];
let content = "";
let pausedStarted: (() => void) | null = null;
let pausedClosed: (() => void) | null = null;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  requests.push(JSON.parse(Buffer.concat(chunks).toString()));
  if (pausedStarted) {
    res.once("close", () => pausedClosed?.());
    pausedStarted();
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
});
const db = await getDB();
const connections = createConnectionsStorage(db);
const chars = createCharactersStorage(db);
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(conversationRoutes, { prefix: "/api/conversation" });
const blocks = [{ time: "00:00-00:00", activity: "Library research", status: "dnd" as const }];
const schedule: WeekSchedule = {
  weekStart: "2026-01-05T00:00:00.000Z",
  days: Object.fromEntries(CONVERSATION_SCHEDULE_DAYS.map((day) => [day, blocks])),
  talkativeness: 37,
  inactivityThresholdMinutes: 85,
  autonomousDailyCapOverride: 4,
  disabledAutonomousIntents: ["meal_break"],
};
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const base = { provider: "custom" as const, baseUrl: `http://127.0.0.1:${address.port}/v1`, apiKey: "fixture" };
  const defaultConnection = await connections.create({
    ...base,
    name: "Default",
    model: "default-model",
    isDefault: true,
  });
  const override = await connections.create({ ...base, name: "Schedule", model: "schedule-model", useForRandom: true });
  const media = await connections.create({
    ...base,
    name: "Images",
    model: "image-model",
    provider: "image_generation",
  });
  const character = await chars.create({
    name: "Schedule fixture",
    extensions: { conversationSchedule: schedule },
  } as never);
  const chat = await chats.create({
    name: "Schedule chat",
    mode: "conversation",
    connectionId: override.id,
    characterIds: [character.id],
  });
  const draft = (payload: Record<string, unknown> = {}) =>
    app.inject({
      method: "POST",
      url: "/api/conversation/schedule/draft",
      payload: { characterId: character.id, mode: "week", schedule, ...payload },
    });
  content = JSON.stringify({ ...schedule, talkativeness: 99 });
  let response = await draft();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(requests.at(-1)?.model, "default-model", "Character editing defaults to the configured language model");
  assert.equal(response.json().schedule.talkativeness, 37, "Generation preserves tuned autonomy settings");
  assert.equal(response.json().schedule.autonomousDailyCapOverride, 4);
  await draft({ chatId: chat.id });
  assert.equal(requests.at(-1)?.model, "schedule-model", "Chat editing inherits its connection");
  await draft({ chatId: chat.id, connectionId: defaultConnection.id });
  assert.equal(requests.at(-1)?.model, "default-model", "An explicit choice overrides the chat connection");
  await draft({ connectionId: override.id });
  assert.equal(requests.at(-1)?.model, "schedule-model", "An explicit choice works without any chat");
  await draft({ connectionId: "random" });
  assert.equal(requests.at(-1)?.model, "schedule-model");
  const beforeInvalid = requests.length;
  for (const connectionId of [media.id, "missing", {}, ""]) {
    response = await draft({ connectionId });
    assert.equal(response.statusCode, 400, response.body);
  }
  assert.equal(requests.length, beforeInvalid, "Invalid choices never call a provider or silently fall back");

  content = JSON.stringify({ blocks });
  for (const draftMode of ["rewrite", "adjust", "vary", "repair"]) {
    response = await draft({
      connectionId: override.id,
      mode: "day",
      day: "Monday",
      draftMode,
      timeZone: "Europe/Warsaw",
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json().blocks, blocks);
    assert.notEqual(
      response.json().weekStart,
      schedule.weekStart,
      "A newly assembled week receives a fresh week start",
    );
    const prompt = requests.at(-1)!.messages[0].content;
    assert.match(
      prompt,
      new RegExp(`Draft action: ${draftMode.charAt(0).toUpperCase() + draftMode.slice(1)} (?:current )?day`),
    );
    assert.match(prompt, /Schedule timezone: Europe\/Warsaw/);
    assert.match(prompt, /Other days are consistency context only/);
    if (draftMode === "repair" || draftMode === "adjust")
      assert.doesNotMatch(prompt, /Do not copy it|materially different/);
  }
  content = "A quiet routine.";
  response = await app.inject({
    method: "POST",
    url: "/api/conversation/schedule/summary",
    payload: { characterId: character.id, connectionId: override.id, schedule },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(requests.at(-1)?.model, "schedule-model", "Routine summaries use the same selected connection");

  for (const invalid of [
    "not JSON",
    '{"days": {',
    "null",
    "{}",
    '{"days":{"Monday":[]}}',
    JSON.stringify({ days: { ...schedule.days, Sunday: [{ time: "00:00-00:00" }] } }),
  ]) {
    content = invalid;
    response = await draft({ connectionId: override.id });
    assert.equal(response.statusCode, 502, `${invalid}: ${response.body}`);
    assert.equal(response.json().rawResponse, invalid, "Invalid output remains available for manual repair");
    assert.match(response.json().error, /model returned (invalid schedule JSON|an empty or invalid schedule)/);
  }
  for (const invalid of [
    "{}",
    '{"blocks": []}',
    '{"blocks": [{"time": "", "activity": "sleep"}]}',
    '{"blocks": [{"time": "later", "activity": "sleep"}]}',
    '{"blocks": [{"time": "25:00-26:75", "activity": "sleep"}]}',
  ]) {
    content = invalid;
    response = await draft({ connectionId: override.id, mode: "day", day: "Monday" });
    assert.equal(response.statusCode, 502, response.body);
  }
  for (const times of [
    ["00:00-00:00"],
    ["06:00-06:00"],
    ["22:00-06:00", "06:00-22:00"],
    ["12:00-18:00", "00:00-12:00", "18:00-00:00"],
  ]) {
    content = JSON.stringify({ blocks: times.map((time) => ({ ...blocks[0], time })) });
    response = await draft({ connectionId: override.id, mode: "day", day: "Monday" });
    assert.equal(response.statusCode, 200, response.body);
  }
  for (const times of [
    ["09:00-17:00"],
    ["00:00-08:00", "09:00-00:00"],
    ["00:00-12:00", "11:00-00:00"],
    ["00:00-12:00", "06:00-18:00"],
    ["00:00-00:00", "00:00-00:00"],
  ]) {
    const invalidBlocks = times.map((time) => ({ ...blocks[0], time }));
    for (const mode of ["day", "week"]) {
      content = JSON.stringify(
        mode === "day" ? { blocks: invalidBlocks } : { days: { ...schedule.days, Monday: invalidBlocks } },
      );
      response = await draft({ connectionId: override.id, mode, day: "Monday" });
      assert.equal(response.statusCode, 502, `Reject partial, gapped, or overlapping days: ${content}`);
    }
  }
  const callsBeforeAutomatic = requests.length;
  const automatic = await app.inject({
    method: "POST",
    url: "/api/conversation/schedule/generate",
    payload: { chatId: chat.id, automatic: true },
  });
  assert.equal(automatic.statusCode, 200, automatic.body);
  assert.equal(requests.length, callsBeforeAutomatic, "A schedule is not consent to automatic renewal");
  assert.equal(automatic.json().results[character.id].status, "renewal_disabled");

  const appAddress = await app.listen({ host: "127.0.0.1", port: 0 });
  for (const [endpoint, payload] of [
    ["draft", { characterId: character.id, mode: "week", schedule }],
    ["draft", { characterId: character.id, mode: "day", day: "Monday", schedule }],
    ["summary", { characterId: character.id, schedule }],
    ["generate", { chatId: chat.id, forceRefresh: true }],
  ] as const) {
    const started = new Promise<void>((resolve) => {
      pausedStarted = resolve;
    });
    const closed = new Promise<void>((resolve) => {
      pausedClosed = resolve;
    });
    const controller = new AbortController();
    const pending = fetch(`${appAddress}/api/conversation/schedule/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch(() => null);
    await started;
    const count = requests.length;
    controller.abort();
    await pending;
    let timer: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        closed,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${endpoint} left the provider running after disconnect`)), 3000);
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
    assert.equal(requests.length, count, "Cancellation never retries the provider");
    pausedStarted = pausedClosed = null;
  }
  const saved = JSON.parse((await chars.getById(character.id))!.data);
  assert.deepEqual(
    saved.extensions.conversationSchedule,
    schedule,
    "Draft generation never overwrites the saved card, even on failure",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Schedule generation routing, draft modes, response validation, and saved-data preservation passed.");
