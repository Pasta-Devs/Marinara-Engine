/** Capability API 1.157: starting coins rolled once when taken, or read off the holder's sheet. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  resolveRulesetStartingGear,
  rulesetItemBook,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-starting-coins-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameInventoryRoutes } = await import("../../../packages/server/src/routes/game-inventory.routes.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });

try {
  const emberText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  const withGear = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    doc.items.startingGear = [
      { id: "purse", label: "Purse", group: "wealth", lines: [{ coins: "mark", roll: "2d6", times: 10 }] },
      {
        id: "patron",
        label: "Patron",
        group: "wealth",
        lines: [{ coins: "bit", countFrom: { field: "toughness" }, times: 2 }],
      },
    ];
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const refusal = (doc: unknown) => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(!parsed.ok, "this document was supposed to be refused");
    return parsed.issues.join("; ");
  };
  const ember = parse(withGear());
  const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
    (ember.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries]] : [],
    ),
  );
  const book = rulesetItemBook(ember, entries);

  // ── The resolver: a preview shows the dice, a take rolls them; a sheet amount reads the holder ──
  const preview = resolveRulesetStartingGear(ember, book, { gear: "purse", choices: [], picks: {} });
  assert.ok(preview.ok);
  assert.deepEqual(
    preview.adds.map((add) => [add.item, add.count, add.rolled]),
    [["coin:mark", 0, "2d6 x 10"]],
  );
  const faces = [3, 4];
  const rolled = resolveRulesetStartingGear(ember, book, { gear: "purse", choices: [], picks: {} }, null, undefined, {
    rollDie: () => faces.shift()!,
  });
  assert.ok(rolled.ok);
  assert.deepEqual(
    rolled.adds.map((add) => [add.item, add.count]),
    [["coin:mark", 70]],
  );
  const tough = {
    ...defaultRulesetSheetBuild(ember),
    fields: { ...defaultRulesetSheetBuild(ember).fields, toughness: 3 },
  };
  const read = resolveRulesetStartingGear(ember, book, { gear: "patron", choices: [], picks: {} }, null, undefined, {
    build: tough,
  });
  assert.ok(read.ok);
  assert.deepEqual(
    read.adds.map((add) => [add.item, add.count]),
    [["coin:bit", 6]],
  );
  const noSheet = resolveRulesetStartingGear(ember, book, { gear: "patron", choices: [], picks: {} });
  assert.equal(noSheet.ok, false);

  // ── The schema ──
  for (const [line, message] of [
    [{ item: "outfitter/road-rations", roll: "1d6" }, /Only coins are rolled/],
    [{ coins: "mark", roll: "1d6", countFrom: { field: "toughness" } }, /rolled or read off the sheet, not both/],
    [{ coins: "mark", times: 3 }, /times multiplies a rolled or read amount/],
    [{ coins: "mark", roll: "lots" }, /Dice look like/],
  ] as const)
    assert.match(refusal(withGear((doc) => (doc.items.startingGear[0].lines = [line]))), message);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "coins",
    name: "Coins",
    version: "1.0.0",
    description: "Coins proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(156, withGear()) ?? "", /1\.157/);
  assert.equal(gate(157, withGear()), null);
  const inChoice = withGear((doc) => {
    doc.items.startingGear = [
      {
        id: "kit",
        label: "Kit",
        choices: [
          {
            label: "Money",
            options: [
              { label: "Rolled", lines: [{ coins: "mark", roll: "1d6" }] },
              { label: "Fixed", lines: [{ coins: "mark", count: 3 }] },
            ],
          },
        ],
      },
    ];
  });
  assert.match(gate(156, inChoice) ?? "", /1\.157/, "a rolled line inside a choice counts");

  // ── The route: rolled once as it is taken, read off the holder's own sheet ──
  const RULESET_ID = "local/ember-coins";
  await createGameRulesetsStorage(db).put({
    rulesetId: RULESET_ID,
    version: 1,
    sourceKind: "local",
    definition: JSON.stringify({ ...withGear(), id: "ember-coins" }),
  });
  const chats = createChatsStorage(db);
  const states = createGameStateStorage(db);
  const chat = await chats.create({ name: "Coins", mode: "game", characterIds: [] });
  const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The road." });
  await chats.patchMetadata(chat.id, {
    gameRuleset: { id: RULESET_ID, version: 1, packageId: null, options: {} },
    gameCharacterCards: [
      { name: "Ada", rulesetSheet: { v: 1, build: tough } },
      { name: "Juno", rulesetSheet: { v: 1, build: { ...tough, fields: { ...tough.fields, toughness: 5 } } } },
    ],
    gameInventory: [],
  });
  await states.create({
    chatId: chat.id,
    messageId: anchor.id,
    swipeIndex: 0,
    date: "",
    time: "",
    location: "road",
    weather: "",
    temperature: "",
    worldCustomFields: [],
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: {},
    hiddenTrackerFields: [],
    committed: true,
  });
  const take = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/game/inventory/starting-gear", payload: { chatId: chat.id, ...payload } });
  const purse = await take({ selection: { gear: "purse", choices: [], picks: {} } });
  assert.equal(purse.statusCode, 200, purse.body);
  const marks = (purse.json().inventory as GameInventoryStack[]).find(
    (stack) => stack.item === "coin:mark" && !stack.holder,
  );
  assert.ok(marks && marks.quantity >= 20 && marks.quantity <= 120 && marks.quantity % 10 === 0, JSON.stringify(marks));
  // Taken once a group: reopening can never roll the purse again.
  const again = await take({ selection: { gear: "purse", choices: [], picks: {} } });
  assert.equal(again.statusCode, 409);
  assert.equal(again.json().reason, "taken");
  const patron = await take({ holder: "Juno", selection: { gear: "patron", choices: [], picks: {} } });
  assert.equal(patron.statusCode, 200, patron.body);
  assert.equal(
    (patron.json().inventory as GameInventoryStack[]).find(
      (stack) => stack.item === "coin:bit" && stack.holder === "Juno",
    )?.quantity,
    10,
    "Juno's own toughness, times two",
  );

  console.log("game-ruleset-starting-coins: passed");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
