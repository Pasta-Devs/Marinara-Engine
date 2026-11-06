// The metadata route validates the ruleset/style pair it actually saves, inside the chat queue.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage, withChatMetadataPatchQueue } =
  await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { chats } = await import("../../packages/server/src/db/schema/index.js");
const db = await getDB();
const storage = createChatsStorage(db);
let afterRouteChatRead: (() => void) | undefined;
const routeDb = new Proxy(db, {
  get(target, key, receiver) {
    if (key !== "select") return Reflect.get(target, key, receiver);
    return (...args: Parameters<typeof db.select>) => {
      const selection = db.select(...args);
      const from = selection.from.bind(selection);
      selection.from = (table) => {
        const query = from(table);
        if (table === chats) {
          const run = query.run.bind(query);
          query.run = async () => {
            const rows = await run();
            const notify = afterRouteChatRead;
            afterRouteChatRead = undefined;
            notify?.();
            return rows;
          };
        }
        return query;
      };
      return selection;
    };
  },
});
const app = Fastify();
app.decorate("db", routeDb);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.ready();

const pin = (id: string) => ({ id: `local/${id}`, version: 1, packageId: null, options: {} });
const read = async (id: string) => {
  const chat = await storage.getById(id);
  assert.ok(chat);
  return { chat, metadata: JSON.parse(chat.metadata as string) as Record<string, unknown> };
};
const create = async (metadata: Record<string, unknown>) => {
  const chat = await storage.create({ name: "Combat guard fixture", mode: "game", characterIds: [] });
  assert.ok(chat);
  await storage.patchMetadata(chat.id, metadata);
  return chat.id;
};
const patch = (id: string, payload: Record<string, unknown>) =>
  app.inject({ method: "PATCH", url: `/api/chats/${id}/metadata`, payload });
const cases: Array<{ name: string; run: () => Promise<void> }> = [];
const check = (name: string, run: () => Promise<void>) => cases.push({ name, run });

try {
  for (const style of ["classic", "tactical"]) {
    const definition = JSON.parse(
      readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
    );
    definition.id = style;
    definition.version = 1;
    definition.combat.styles = [style];
    await createGameRulesetsStorage(db).put({
      rulesetId: `local/${style}`,
      version: 1,
      sourceKind: "local",
      definition: JSON.stringify(definition),
    });
  }

  for (const hideSummarisedMessages of [undefined, true]) {
    const extra = hideSummarisedMessages === undefined ? {} : { hideSummarisedMessages };
    const path = hideSummarisedMessages === undefined ? "ordinary" : "summary-hiding";
    check(`${path}: ruleset-only change refuses an incompatible saved style without writing`, async () => {
      const id = await create({ gameRuleset: pin("classic"), gameCombatStyle: "classic" });
      const before = await read(id);
      const response = await patch(id, { gameRuleset: pin("tactical"), ...extra });
      assert.equal(response.statusCode, 400, response.body);
      assert.equal(response.json().code, "combat_style_not_allowed");
      assert.deepEqual(await read(id), before, "a refusal cannot write metadata, ordinals or activity");
    });
    check(`${path}: a combined change is checked against the new ruleset`, async () => {
      const id = await create({ gameRuleset: pin("classic"), gameCombatStyle: "classic" });
      const response = await patch(id, { gameRuleset: pin("tactical"), gameCombatStyle: "tactical", ...extra });
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual((await read(id)).metadata.gameRuleset, pin("tactical"));
      assert.equal((await read(id)).metadata.gameCombatStyle, "tactical");
    });
    check(`${path}: a combined incompatible change cannot partially save`, async () => {
      const id = await create({ gameRuleset: pin("classic"), gameCombatStyle: "classic" });
      const before = await read(id);
      const response = await patch(id, { gameRuleset: pin("tactical"), gameCombatStyle: "classic", ...extra });
      assert.equal(response.statusCode, 400, response.body);
      assert.deepEqual(await read(id), before);
    });
  }

  check("style-only updates still enforce the saved ruleset", async () => {
    const id = await create({ gameRuleset: pin("tactical"), gameCombatStyle: "tactical" });
    const response = await patch(id, { gameCombatStyle: "classic" });
    assert.equal(response.statusCode, 400);
    assert.equal((await read(id)).metadata.gameCombatStyle, "tactical");
  });
  check("removing the ruleset restores unrestricted style selection", async () => {
    const id = await create({ gameRuleset: pin("tactical"), gameCombatStyle: "tactical" });
    assert.equal((await patch(id, { gameRuleset: null, gameCombatStyle: "classic" })).statusCode, 200);
    assert.equal((await read(id)).metadata.gameRuleset, null);
    assert.equal((await read(id)).metadata.gameCombatStyle, "classic");
  });
  check("a missing explicit style is validated as the existing classic default", async () => {
    const id = await create({});
    assert.equal((await patch(id, { gameRuleset: pin("tactical") })).statusCode, 400);
    assert.equal((await patch(id, { gameRuleset: pin("classic") })).statusCode, 200);
  });
  check("an unrelated preference does not revalidate an old incompatible pair", async () => {
    const id = await create({ gameRuleset: pin("tactical"), gameCombatStyle: "classic" });
    assert.equal((await patch(id, { chatSettingsHintDismissed: true })).statusCode, 200);
    assert.equal((await read(id)).metadata.chatSettingsHintDismissed, true);
  });
  for (const hideSummarisedMessages of [undefined, true]) {
    check(`a queued style change reads fresh ruleset state (${hideSummarisedMessages ?? "ordinary"})`, async () => {
      const id = await create({ gameRuleset: pin("classic"), gameCombatStyle: "classic" });
      let entered!: () => void;
      const enteredQueue = new Promise<void>((resolve) => (entered = resolve));
      let release!: () => void;
      const blocked = new Promise<void>((resolve) => (release = resolve));
      const earlier = withChatMetadataPatchQueue(id, async () => {
        entered();
        await blocked;
        await storage.patchMetadata(
          id,
          { gameRuleset: pin("tactical"), gameCombatStyle: "tactical" },
          { metadataQueueHeld: true },
        );
      });
      await enteredQueue;
      const staleRowRead = new Promise<void>((resolve) => (afterRouteChatRead = resolve));
      // Instrument only completion of the real row read, never its result or queue behavior.
      const request = patch(id, {
        gameCombatStyle: "classic",
        ...(hideSummarisedMessages === undefined ? {} : { hideSummarisedMessages }),
      });
      void request.then(() => {});
      await staleRowRead;
      release();
      await earlier;
      const response = await request;
      assert.equal(response.statusCode, 400, response.body);
      assert.equal((await read(id)).metadata.gameCombatStyle, "tactical");
      assert.deepEqual((await read(id)).metadata.gameRuleset, pin("tactical"));
    });
  }

  const failures: string[] = [];
  for (const { name, run } of cases) {
    try {
      await run();
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      failures.push(name);
      process.stderr.write(`FAIL ${name}: ${String(error)}\n`);
    }
  }
  assert.deepEqual(failures, [], "all real metadata route controls pass");
} finally {
  await app.close();
  await closeDB();
}
