import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-text-dice-"));
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
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { resolveGameDiceRequests } = await import("../../packages/server/src/services/game/dice.service.js");
const { parseSkillCheckTagBody, createSkillCheckTagRegex, characterDataSchema, getRoleplayCommandActivity } =
  await import("../../packages/shared/dist/index.js");
const { readDiceRollResults, readRoleplayDiceRolls } =
  await import("../../packages/client/src/lib/dice-roll-result.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");
const { GrokSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/grok-subscription.provider.js");

const resolved = resolveGameDiceRequests("Before [dice: 3d1+2] between [dice: d1-2] after.");
assert.deepEqual(
  resolved.diceRolls.map((roll) => roll.total),
  [5, -1],
);
assert.match(resolved.content, /^Before \[dice: 3d1\+2 = 5/);
assert.match(resolved.content, /between \[dice: d1-2 = -1/);
assert.equal(resolveGameDiceRequests(resolved.content).rolled, 0, "stored dice records are not new requests");
assert.deepEqual(
  resolveGameDiceRequests(resolved.content).unresolved,
  [],
  "stored records are not diagnostic failures",
);
assert.equal(resolveGameDiceRequests("[dice: 500d5000]").diceRolls[0]?.notation, "100d1000");
for (const invalid of ["0d6", "d0", "no dice", "1d6+9007199254740991"]) {
  const result = resolveGameDiceRequests(`[dice: ${invalid}]`);
  assert.equal(result.rolled, 0, invalid);
  assert.match(result.unresolved[0]!, /Unsupported dice notation/);
}
for (const declaration of ['dice="4d6kh3"', 'dice="3d6!"', 'dice="4dF"', 'resolution="successes"']) {
  const result = resolveGameDiceRequests(
    `[skill_check: skill="Unsupported" dc="4" ${declaration} rolls="6|6" total="12" result="success"]`,
  );
  assert.equal(result.rolled, 0);
  assert.equal(result.unresolved.length, 1);
  assert.doesNotMatch(result.content, /rolls=|total=|result=/);
  assert.ok(
    result.content.toLowerCase().includes(declaration.toLowerCase()),
    `sparse records preserve the rule: ${result.content}`,
  );
  assert.equal(resolveGameDiceRequests(result.content).rolled, 0, "sparse pools cannot become an implicit d20");
}
assert.deepEqual(readDiceRollResults(resolved.diceRolls), resolved.diceRolls);
assert.deepEqual(readDiceRollResults(resolved.diceRolls[0]), [resolved.diceRolls[0]]);
assert.deepEqual(readDiceRollResults([null, {}, { ...resolved.diceRolls[0], total: Infinity }]), []);

const pool = resolveGameDiceRequests(
  '[skill_check: skill="Pool" dc="4" dice="6d1" resolution="successes" threshold="1" rolls="9" total="99" result="failure"]',
);
assert.equal(pool.checkResults[0]?.total, 6);
assert.equal(pool.checkResults[0]?.success, true);
assert.equal(pool.checkResults[0]?.resolution, "successes");
const parsedPool = parseSkillCheckTagBody(pool.content.replace(/^\[skill_check:\s*|]$/g, ""));
assert.equal(parsedPool?.resolvedResult?.total, 6, "the saved pool renders through the existing skill card");
const unspecified = resolveGameDiceRequests(
  '[skill_check: skill="Pool" dc="4" dice="6d10" resolution="successes" rolls="10|10|10|10|10|10" modifier="0" total="6" result="success"]',
);
assert.equal(unspecified.rolled, 0);
assert.doesNotMatch(
  unspecified.content,
  /rolls=|total=|result=/,
  "undefined pool rules cannot retain invented numbers",
);
for (const dice of ["3d1+2", "1d1+3", "2d1"]) {
  const check = resolveGameDiceRequests(`[skill_check: skill="Other system" dc="5" dice="${dice}"]`);
  assert.equal(check.checkResults.length, 1, dice);
  assert.equal(
    check.checkResults[0]!.total,
    check.checkResults[0]!.rolls.reduce((sum, roll) => sum + roll, 0) + check.checkResults[0]!.modifier,
  );
}
const actualToolRoll = { notation: "1d20+3", rolls: [17], modifier: 3, total: 20 };
assert.equal(
  resolveGameDiceRequests(
    '[skill_check: skill="Athletics" dc="15" dice="1d20+3" rolls="17" modifier="3" total="20" result="success"]',
    [actualToolRoll],
    () => {
      throw new Error("Do not reroll a real tool result");
    },
  ).rolled,
  0,
);

const calls: ChatMessage[][] = [];
let failContinuation = false;
let roleplay = false;
let unsupportedOnly = false;
const raw =
  'He does not see you. [skill_check: skill="Stealth" dc="40" rolls="2"] You escape unseen. [dice: 3d1+2] [skill_check: skill="Pool" dc="6" dice="6d1" resolution="successes" threshold="1"]';
async function* scriptedChat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage> {
  calls.push(structuredClone(messages));
  assert.equal(options.tools, undefined, "subscription transports never receive native tool schemas");
  if (roleplay) {
    if (messages.at(-1)?.content.includes("The engine resolved your roll request:")) {
      assert.match(messages.at(-1)!.content, /"total":[123]/);
      if (calls.length === 2) {
        yield 'The real die total is below three; the lock stays shut. She tries the window. [roll: character="Mari" notation="2d2-1"] An invented second outcome.';
      } else {
        yield "The window stays shut too.";
      }
    } else {
      yield 'Mari reaches for the lock. [roll: character="Mari" notation="1d2" reason="The lock opens on a total of three"] The lock springs open without a real roll.';
    }
  } else if (messages.at(-1)?.content.includes("The engine has now rolled the requested dice:")) {
    assert.equal(options.tools, undefined, "outcome continuation needs no native tools schema");
    assert.equal(unsupportedOnly, false, "unsupported requests have no real outcome to rewrite");
    assert.match(messages.at(-1)!.content, /Stealth/);
    assert.match(messages.at(-1)!.content, /3d1\+2 = 5/);
    if (failContinuation) {
      yield "UNSAFE PARTIAL OUTCOME";
      throw new Error("Synthetic provider failure");
    }
    yield "The guard spots you. The pool succeeds. [dice: d1 = 999]";
  } else {
    yield unsupportedOnly ? "The attack wins with a fabricated total. [dice: 4d6kh3]" : raw;
  }
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
}
const originalClaude = ClaudeSubscriptionProvider.prototype.chat;
const originalGrok = GrokSubscriptionProvider.prototype.chat;
ClaudeSubscriptionProvider.prototype.chat = scriptedChat;
GrokSubscriptionProvider.prototype.chat = scriptedChat;
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  for (const provider of ["claude_subscription", "grok_subscription"] as const) {
    const connection = await createConnectionsStorage(db).create({
      name: "Text-only fixture",
      provider,
      model: "fixture",
      apiKey: "synthetic-fixture",
      maxContext: 32768,
    });
    const chat = await chats.create({
      name: "Text dice",
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false });
    for (const failure of [false, true]) {
      calls.length = 0;
      failContinuation = failure;
      await chats.createMessage({
        chatId: chat.id,
        role: "user",
        content: "Try to sneak past the guard. [dice: d20 = 2]",
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, streaming: true },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
      assert.equal(calls.length, 2, "exactly one outcome continuation, without native tools");
      const saved = (await chats.listMessages(chat.id)).at(-1)!;
      assert.equal(saved.role, "assistant");
      assert.doesNotMatch(
        saved.content,
        /He does not see you|escape unseen|UNSAFE PARTIAL|999/,
        "no guessed or partial outcome survives",
      );
      if (!failure) assert.match(saved.content, /The guard spots you/);
      const extra = JSON.parse(saved.extra);
      assert.equal(extra.gameOutcomeNarrationFailed, failure);
      assert.equal(response.body.includes('"type":"game_outcome_narration_failed"'), failure);
      if (failure) {
        assert.equal(
          saved.content.replace(/\[(?:dice|skill_check):[^\]]+\]/gi, "").trim(),
          "",
          "failure keeps the real log records without repeating their totals as prose",
        );
      }
      assert.deepEqual(extra.diceRollResults, [{ notation: "3d1+2", rolls: [1, 1, 1], modifier: 2, total: 5 }]);
      const checks = [...saved.content.matchAll(createSkillCheckTagRegex())].map((match) =>
        parseSkillCheckTagBody(match[1]!),
      );
      assert.equal(checks.length, 2, "the rewrite cannot duplicate or change recorded checks");
      assert.equal(checks[0]?.resolvedResult?.success, false);
      assert.equal(checks[1]?.resolvedResult?.total, 6);
      assert.match(response.body, /"diceRollResult":\{"notation":"3d1\+2"/, "the text roll uses the live card event");
    }
    failContinuation = false;
    unsupportedOnly = true;
    calls.length = 0;
    const unsupported = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.ok(!unsupported.body.includes('"type":"error"'), unsupported.body);
    assert.equal(calls.length, 1, "unsupported-only requests do not pay for an outcome rewrite when nothing rolled");
    const unresolved = (await chats.listMessages(chat.id)).at(-1)!;
    assert.match(
      unresolved.content,
      /\[dice: 4d6kh3\]/,
      "the unsupported request remains available for the user to correct",
    );
    assert.ok(!unsupported.body.includes('"diceRollResult":'), "unsupported notation is never silently substituted");
    unsupportedOnly = false;

    await chats.patchMetadata(chat.id, { gameDiceOutcomeNarration: false });
    calls.length = 0;
    const optOut = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.ok(!optOut.body.includes('"type":"error"'), optOut.body);
    assert.equal(calls.length, 1, "turning off immediate narration saves the extra model request");
    const retained = (await chats.listMessages(chat.id)).at(-1)!;
    assert.match(retained.content, /\[dice: 3d1\+2 = 5/);
    assert.match(retained.content, /result="failure"/);
    assert.equal(JSON.parse(retained.extra).diceRollResults[0].total, 5);
    assert.equal(JSON.parse((await chats.getById(chat.id))!.metadata).gameDiceOutcomeNarration, false);
    await chats.patchMetadata(chat.id, { gameDiceOutcomeNarration: true });

    roleplay = true;
    const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Mari" }));
    assert(character);
    const rp = await chats.create({
      name: "Roleplay text roll",
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert(rp);
    await chats.patchMetadata(rp.id, {
      enableAgents: false,
      enableTools: false,
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { roll: true },
    });
    await chats.createMessage({ chatId: rp.id, role: "user", content: "Try the lock; roll before resolving it." });
    calls.length = 0;
    const rpResponse = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: rp.id } });
    assert.ok(!rpResponse.body.includes('"type":"error"'), rpResponse.body);
    assert.equal(calls.length, 3, "each Roleplay roll resumes with its own real result without native tools");
    const rpSaved = (await chats.listMessages(rp.id)).at(-1)!;
    assert.match(rpSaved.content, /real die total is below three/);
    assert.doesNotMatch(rpSaved.content, /springs open without a real roll|\[roll:/);
    const activities = getRoleplayCommandActivity(JSON.parse(rpSaved.extra));
    assert.equal(activities.length, 2);
    assert.equal(activities[0]?.command.type, "roll");
    assert.equal(activities[0]?.error, undefined);
    assert.ok([1, 2].includes(JSON.parse(activities[0]!.result!).total));
    assert.ok([1, 2, 3].includes(JSON.parse(activities[1]!.result!).total));
    const inlineRolls = readRoleplayDiceRolls(rpSaved.content, JSON.parse(rpSaved.extra));
    assert.deepEqual(
      inlineRolls.map(({ offset }) => rpSaved.content.slice(0, offset)),
      [
        "Mari reaches for the lock.",
        "Mari reaches for the lock. The real die total is below three; the lock stays shut. She tries the window.",
      ],
    );
    assert.doesNotMatch(rpSaved.content, /invented second outcome/);
    assert.match(rpResponse.body, /"diceRollResult":\{"notation":"1d2"/);
    roleplay = false;
  }
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalClaude;
  GrokSubscriptionProvider.prototype.chat = originalGrok;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Text dice and explicit pools resolve honestly on both subscription paths, including failed narration.");
