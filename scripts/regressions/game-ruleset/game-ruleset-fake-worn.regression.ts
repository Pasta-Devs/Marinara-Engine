/**
 * A fake worn or carried (P1-7 follow-up, the user's ruling "true and reveal"):
 *
 *   - The sheet reads what a fake truly does: its worn or carried effects and its stats.
 *   - The first change after which the sheet shows a number (or what a check adds) that the item it
 *     passes for would not, finds it out: the stack becomes its true item, and the journal says what
 *     it was. A fake whose truth the sheet cannot tell apart stays a fake.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetFakesTheSheetShows,
  readRulesetLive,
  rulesetItemSources,
  type RulesetSheetItem,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-fake-worn-"));
process.env.DATA_DIR = dataDir;

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createGameRulesetsStorage } =
  await import("../../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameInventoryRoutes } = await import("../../../packages/server/src/routes/game-inventory.routes.js");
const { withFoundOut } = await import("../../../packages/server/src/services/game/game-inventory.service.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  // Gravewatch with two coats that pass for the lantern-keeper's: one that chills its wearer (worse
  // at warding, which a check reads), and one the sheet cannot tell from the real thing.
  const doc = JSON.parse(read("../../../docs/examples/rulesets/gravewatch.json")) as Record<string, any>;
  const kit = doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
  kit.entries.push(
    {
      id: "chill-coat",
      label: "Chill coat",
      item: {
        category: "coat",
        slots: { body: 1 },
        passesFor: "kit/lantern-coat",
        cost: { amount: 1, unit: "penny" },
        worn: { modifiers: [{ to: "checks", skills: ["ward"], flat: -1 }] },
      },
    },
    {
      id: "plain-coat",
      label: "Plain coat",
      item: {
        category: "coat",
        slots: { body: 1 },
        passesFor: "kit/lantern-coat",
        cost: { amount: 1, unit: "penny" },
        stats: { soak_blunt: 1, soak_tearing: 1 },
      },
    },
  );
  // And a thin coat whose soak is less, which a sheet that adds up worn soak shows.
  kit.entries.push({
    id: "thin-coat",
    label: "Thin coat",
    item: {
      category: "coat",
      slots: { body: 1 },
      passesFor: "kit/lantern-coat",
      cost: { amount: 1, unit: "penny" },
      stats: { soak_blunt: 0, soak_tearing: 0 },
    },
  });
  // And a warding coat whose only difference is a fight's (a resistance), which no check reads.
  kit.entries.push({
    id: "ward-coat",
    label: "Ward coat",
    item: {
      category: "coat",
      slots: { body: 1 },
      passesFor: "kit/lantern-coat",
      cost: { amount: 1, unit: "penny" },
      stats: { soak_blunt: 1, soak_tearing: 1 },
      worn: { resist: ["burning"] },
    },
  });
  doc.sheet.derived.push({
    id: "worn_soak",
    label: "Worn soak",
    op: "sum",
    of: [{ itemStat: { stat: "soak_blunt", from: "worn", pick: "sum" } }],
  });
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  const coatOf = (id: string) =>
    definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries!.find((entry) => entry.id === id)!.item!;

  // ── The sheet ──
  {
    const build = defaultRulesetSheetBuild(definition);
    const worn = (truly: string): RulesetSheetItem => ({
      item: coatOf("lantern-coat"),
      quantity: 1,
      worn: true,
      name: "Lantern-keeper's coat",
      truly: { item: coatOf(truly), name: truly },
    });
    const sources = (items: readonly RulesetSheetItem[], sheet: () => any) =>
      rulesetItemSources(definition, build, items, sheet);
    const live = readRulesetLive(definition, build, undefined);
    assert.deepEqual(rulesetFakesTheSheetShows(definition, build, [worn("chill-coat")], sources, live), [0]);
    assert.deepEqual(rulesetFakesTheSheetShows(definition, build, [worn("plain-coat")], sources, live), []);
    assert.deepEqual(rulesetFakesTheSheetShows(definition, build, [worn("thin-coat")], sources, live), [0]);
    // Carried, not worn, a coat does nothing either way.
    assert.deepEqual(
      rulesetFakesTheSheetShows(definition, build, [{ ...worn("chill-coat"), worn: false }], sources, live),
      [],
    );
    // What a check reads is the truth's.
    const chilled = rulesetItemSources(definition, build, [worn("chill-coat")], () => ({}) as never);
    assert.deepEqual(
      chilled.map((source) => source.modifiers?.[0]?.flat),
      [-1],
    );
  }

  // ── Through the inventory: put on, it is found out ──
  {
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/gravewatch-fake-worn",
      version: 1,
      sourceKind: "local",
      definition: JSON.stringify({ ...doc, id: "gravewatch-fake-worn" }),
    });
    const chats = createChatsStorage(db);
    const chat = await chats.create({ name: "Fakes worn", mode: "game", characterIds: [] });
    await chats.patchMetadata(chat.id, {
      gameRuleset: { id: "local/gravewatch-fake-worn", version: 1, packageId: null, options: {} },
      gameCharacterCards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
      gameInventory: [
        {
          id: "st-chill",
          name: "Lantern-keeper's coat",
          item: "kit/lantern-coat",
          quantity: 1,
          truly: "kit/chill-coat",
        },
        {
          id: "st-plain",
          name: "Lantern-keeper's coat",
          item: "kit/lantern-coat",
          quantity: 1,
          truly: "kit/plain-coat",
        },
      ],
    });
    const ops = (body: unknown[]) =>
      app.inject({ method: "POST", url: "/game/inventory", payload: { chatId: chat.id, ops: body } });
    // The plain one, worn: nothing on the sheet tells, so it stays a fake.
    const plain = await ops([{ op: "equip", id: "st-plain" }]);
    assert.equal(plain.statusCode, 200, plain.body);
    const afterPlain = plain.json().inventory as Array<{
      id: string;
      item: string;
      truly?: string;
      equipped?: boolean;
    }>;
    assert.deepEqual(
      afterPlain.find((stack) => stack.id === "st-plain"),
      {
        id: "st-plain",
        name: "Lantern-keeper's coat",
        item: "kit/lantern-coat",
        quantity: 1,
        truly: "kit/plain-coat",
        equipped: true,
      },
    );
    await ops([{ op: "unequip", id: "st-plain" }]);
    // The chilling one, worn: what a ward check adds changes, so it is found out.
    const chill = await ops([{ op: "equip", id: "st-chill" }]);
    assert.equal(chill.statusCode, 200, chill.body);
    assert.deepEqual(chill.json().foundOut, ["Your Lantern-keeper's coat was really Chill coat."]);
    const found = (chill.json().inventory as Array<{ id: string; item: string; name: string; truly?: string }>).find(
      (stack) => stack.id === "st-chill",
    );
    assert.deepEqual([found?.item, found?.name, found?.truly], ["kit/chill-coat", "Chill coat", undefined]);
    const meta = JSON.parse((await chats.getById(chat.id))!.metadata as string);
    const lines = JSON.stringify(meta.gameJournal);
    assert.match(lines, /Your Lantern-keeper's coat was really Chill coat\./);
    // A card with no sheet of its own is not one a fake is read off.
    const unsheeted = await chats.create({ name: "No sheet", mode: "game", characterIds: [] });
    await chats.patchMetadata(unsheeted.id, {
      gameRuleset: { id: "local/gravewatch-fake-worn", version: 1, packageId: null, options: {} },
      gameCharacterCards: [{ name: "Ada" }],
      gameInventory: [
        {
          id: "st-chill",
          name: "Lantern-keeper's coat",
          item: "kit/lantern-coat",
          quantity: 1,
          truly: "kit/chill-coat",
        },
      ],
    });
    const blind = await app.inject({
      method: "POST",
      url: "/game/inventory",
      payload: { chatId: unsheeted.id, ops: [{ op: "equip", id: "st-chill" }] },
    });
    assert.equal(blind.json().inventory[0].truly, "kit/chill-coat");
    // A difference only a fight reads does not find a fake out.
    const warded = await chats.create({ name: "Ward", mode: "game", characterIds: [] });
    await chats.patchMetadata(warded.id, {
      gameRuleset: { id: "local/gravewatch-fake-worn", version: 1, packageId: null, options: {} },
      gameCharacterCards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
      gameInventory: [
        { id: "st-ward", name: "Lantern-keeper's coat", item: "kit/lantern-coat", quantity: 1, truly: "kit/ward-coat" },
      ],
    });
    const ward = await app.inject({
      method: "POST",
      url: "/game/inventory",
      payload: { chatId: warded.id, ops: [{ op: "equip", id: "st-ward" }] },
    });
    assert.equal(ward.json().inventory[0].truly, "kit/ward-coat", ward.body);
  }

  // ── A turn's record remembers the revealed stacks, so a swipe still finds its turn ──
  {
    const turnStacks = [{ id: "a", name: "Coat", quantity: 1, truly: "kit/chill-coat" }] as never[];
    const revealed = [{ id: "a", name: "Chill coat", item: "kit/chill-coat", quantity: 1 }] as never[];
    const changed = withFoundOut(
      {
        stacks: turnStacks,
        journal: [],
        value: null,
        metadata: { gameInventoryTurn: { messageId: "m", before: [], swipes: { "0": [], "1": turnStacks } } },
      },
      { stacks: revealed, events: [{ title: "t", content: "c" }] },
    );
    assert.deepEqual((changed.metadata!.gameInventoryTurn as any).swipes, { "0": [], "1": revealed });
    assert.equal(changed.stacks, revealed);
  }

  console.log("Fakes worn: the sheet reads the truth, and a fake it tells apart is found out.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
