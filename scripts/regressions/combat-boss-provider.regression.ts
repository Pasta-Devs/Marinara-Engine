import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
const dataDir = mkdtempSync(join(tmpdir(), "marinara-boss-provider-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/src/schemas/character.schema.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { chooseGmCombatOption } = await import("../../packages/server/src/services/game/combat-boss.service.js");
const { createCombatDirector, commandCombatDirector } =
  await import("../../packages/server/src/services/game/combat-director.service.js");
let payload: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  },
  replyText = '{"candidateId":"0"}',
  broken = false;
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  payload = JSON.parse(raw);
  if (broken) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "fixture refuses" } }));
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      id: "local-proof",
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content: replyText }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
  );
});
try {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const db = await getDB();
  const connection = await createConnectionsStorage(db).create({
    name: "Local GM fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${addr.port}/v1`,
    model: "fixture-model",
    treatAsLocalEndpoint: true,
  });
  await createConnectionsStorage(db).updateDefaultParameters(connection.id, {
    temperature: 0.27,
    maxTokens: 4096,
    topP: 0.6,
    enabledParameters: { topP: false },
  });
  const chats = createChatsStorage(db),
    chat = await chats.create({ name: "GM proof", mode: "game", characterIds: [], connectionId: connection.id });
  const gm = await createCharactersStorage(db).create(
    characterDataSchema.parse({
      name: "GM",
      description: "A patient referee. {{// private card comment}}",
      personality: "Protective of the story.",
      creator_notes: "Do not send these editing notes.",
    }),
  );
  await chats.patchMetadata(chat.id, { gameGmCharacterId: gm!.id });
  const base = { hp: 100, maxHp: 100, mp: 10, maxMp: 10, attack: 8, defense: 5, speed: 5, level: 2 };
  const state = createCombatDirector({
    id: "proof",
    anchor: "anchor",
    party: [
      {
        ...base,
        id: "mage",
        name: "Mage",
        side: "player",
        skills: [
          { id: "fire", name: "Fireball", type: "attack", spell: true, mpCost: 8, power: 2, range: 8, areaRadius: 1 },
        ],
      },
    ],
    enemies: [
      { ...base, id: "boss", name: "Boss", side: "enemy", boss: { points: 3, anticipation: true, defendCost: 1 } },
    ],
    inventory: [{ name: "Potion", quantity: 2 }],
    style: "tactical",
    gm: true,
    difficulty: "normal",
    seed: 1,
  });
  commandCombatDirector(state, { type: "begin", unitId: "mage" });
  assert.equal(await chooseGmCombatOption(db, chat.id, state, false, AbortSignal.timeout(3000)), "0");
  assert.equal(payload!.model, "fixture-model");
  assert.equal(payload!.temperature, 0.27);
  assert.equal(payload!.max_tokens, 4096);
  assert.equal(payload!.top_p, undefined, "disabled sampling remains omitted");
  const instructions = payload!.messages.find((m) => m.role === "system")!.content;
  assert.ok(instructions.includes("A patient referee.") && instructions.includes("Protective of the story."));
  assert.ok(!instructions.includes("private card comment") && !instructions.includes("editing notes"));
  const context = JSON.parse(payload!.messages.find((m) => m.role === "user")!.content);
  assert.equal(context.window.kind, "anticipation");
  assert.equal(context.units[0].skills[0].name, "Fireball");
  assert.equal(context.inventory[0].quantity, 2);
  assert.equal(context.units[0].mp, 10);
  assert.equal(context.seed, undefined);
  assert.equal(context.pending, undefined);
  await createConnectionsStorage(db).updateDefaultParameters(connection.id, {});
  assert.equal(await chooseGmCombatOption(db, chat.id, state, false, AbortSignal.timeout(3000)), "0");
  assert.equal(payload!.temperature, 0.5, "unconfigured boss decisions keep their task default");
  await createConnectionsStorage(db).updateDefaultParameters(connection.id, {
    temperature: 0.27,
    maxTokens: 4096,
    topP: 0.6,
    enabledParameters: { topP: false },
  });
  replyText = '{"candidateId":"invented-free-action"}';
  await assert.rejects(
    chooseGmCombatOption(db, chat.id, state, false, AbortSignal.timeout(3000)),
    /invalid combat candidate/,
  );
  replyText = "not json";
  await assert.rejects(chooseGmCombatOption(db, chat.id, state, false, AbortSignal.timeout(3000)));
  replyText = '```json\n{"candidateId":"pass"}\n```';
  assert.equal(await chooseGmCombatOption(db, chat.id, state, false, AbortSignal.timeout(3000)), "pass");
  const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
  const { encounterRoutes } = await import("../../packages/server/src/routes/encounter.routes.js");
  const app = Fastify();
  app.decorate("db", db);
  await app.register(encounterRoutes, { prefix: "/encounter" });
  const { logger } = await import("../../packages/server/src/lib/logger.js");
  const warned: string[] = [];
  const warn = logger.warn.bind(logger);
  logger.warn = ((...args: unknown[]) => {
    warned.push(args.map(String).join(" "));
    return (warn as (...rest: unknown[]) => void)(...args);
  }) as typeof logger.warn;
  try {
    // Every refused setup is logged with its reason, from the first check on.
    for (const [sent, status, reason] of [
      [{ settings: {} }, 400, "Missing required fields"],
      [{ chatId: "no-such-chat", settings: {} }, 404, "Chat not found"],
    ] as const) {
      warned.length = 0;
      const refused = await app.inject({ method: "POST", url: "/encounter/init", payload: sent });
      assert.equal(refused.statusCode, status, refused.body);
      assert.ok(
        warned.some((line) => line.includes("refused") && line.includes(reason)),
        `logged: ${JSON.stringify(warned)}`,
      );
    }
    // A call that throws is answered 500, logged once on the same line with what threw.
    broken = true;
    warned.length = 0;
    const thrown = await app.inject({
      method: "POST",
      url: "/encounter/init",
      payload: { chatId: chat.id, settings: {} },
    });
    broken = false;
    assert.equal(thrown.statusCode, 500, thrown.body);
    const init = warned.filter((line) => line.includes("[game/combat:init]"));
    assert.equal(init.length, 1, `one line: ${JSON.stringify(init)}`);
    assert.match(init[0]!, /refused: .*Encounter init failed: .*fixture refuses/);
    for (const pool of [{ mp: 11, maxMp: 10 }, { mp: 0, maxMp: 10 }, { mp: 10 }, { maxMp: 10 }, {}]) {
      replyText = JSON.stringify({ party: [{ name: "Hero" }], enemies: [{ name: "Caster", ...pool }] });
      const response = await app.inject({
        method: "POST",
        url: "/encounter/init",
        payload: { chatId: chat.id, settings: {} },
      });
      assert.equal(payload!.temperature, 0.27, "encounter helpers inherit connection sampling");
      // The fight's setup asks for at least its own budget, whatever smaller size the connection names.
      assert.equal(payload!.max_tokens, 12000, "the fight's setup keeps room for its answer");
      assert.equal(payload!.top_p, undefined);
      const invalid = "mp" in pool && "maxMp" in pool && pool.mp! > pool.maxMp!;
      assert.equal(response.statusCode, invalid ? 502 : 200, response.body);
      if (invalid) assert.match(response.json().error, /Invalid resource pool/);
      if (invalid) assert.ok(warned.some((line) => line.includes("refused") && line.includes("Invalid resource pool")));
    }

    // A ruleset that turns Game Mode's own items off (#6822): the model is not asked what the
    // inventory's items do, and whatever it guesses anyway is dropped.
    const ember = JSON.parse(
      readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
    ) as Record<string, any>;
    const closed = { ...ember, id: "ember-encounter-no-items", items: { ...ember.items, native: false } };
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/ember-encounter-no-items",
      version: closed.version,
      sourceKind: "local",
      definition: JSON.stringify(closed),
    });
    const guessed = { name: "Potion", target: "ally", type: "heal", description: "Heals", power: 0.3 };
    replyText = JSON.stringify({ party: [{ name: "Hero" }], enemies: [{ name: "Rat" }], itemEffects: [guessed] });
    const withItems = await app.inject({
      method: "POST",
      url: "/encounter/init",
      payload: { chatId: chat.id, settings: {} },
    });
    assert.equal(withItems.statusCode, 200, withItems.body);
    assert.deepEqual(withItems.json().combatState.itemEffects, [guessed], "Game Mode's own items keep the guess");
    assert.match(JSON.stringify(payload!.messages), /\\"itemEffects\\": \[/);
    await chats.patchMetadata(chat.id, {
      gameRuleset: { id: "local/ember-encounter-no-items", version: closed.version, packageId: null, options: {} },
    });
    const noItems = await app.inject({
      method: "POST",
      url: "/encounter/init",
      payload: { chatId: chat.id, settings: {} },
    });
    assert.equal(noItems.statusCode, 200, noItems.body);
    assert.deepEqual(noItems.json().combatState.itemEffects, []);
    assert.doesNotMatch(JSON.stringify(payload!.messages), /itemEffects\\": \[/);
    assert.match(JSON.stringify(payload!.messages), /says what its own items do in a fight, so give no itemEffects/);
  } finally {
    logger.warn = warn;
    await app.close();
  }
  console.log(
    "GM provider adapter: configured connection, actual outbound context, legal candidate parsing and malformed-output rejection passed against a local HTTP fixture.",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
