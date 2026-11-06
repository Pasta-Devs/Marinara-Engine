/**
 * An item that harms whoever takes it up (Capability API 1.701): 5e's Talisman of Pure Good, "A
 * creature that is neither good nor evil in alignment takes 6d6 radiant damage upon touching the
 * talisman. An evil creature takes 8d6 radiant damage upon touching the talisman."
 *
 *   - On a sheet: the evil take 8d6, the neutral 6d6, the good nothing.
 *   - Through the inventory: added to an evil knight's bag, it burns him, the journal says so; given
 *     on to a good saint, nothing.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  readRulesetLive,
  rulesetItemTouchHarm,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetLiveState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-touch-harms-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });

try {
  assert.ok(supportedCapabilityApi.minor >= 701);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const lines = [
    { needs: [{ value: { derived: "goodness" }, atMost: -1 }], dice: "8d6", type: "radiant" },
    { needs: [{ value: { derived: "goodness" }, atMost: 0 }], dice: "6d6", type: "radiant" },
  ];
  const fiveE = (touchHarms: unknown[] = lines): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.derived.push({
      id: "goodness",
      label: "Goodness",
      op: "wordsTable",
      from: { field: "alignment" },
      table: { good: 1, evil: -1 },
      default: 0,
    });
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "neck", label: "Neck", count: 1 }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "talisman",
          label: "Talisman of Pure Good",
          item: { category: "gear", slots: { neck: 1 }, touchHarms },
        },
      ],
    });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const doc = fiveE();
  const definition = parsed(doc);
  const talisman = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const build = (alignment: string) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      fields: { level: 9, ac: 18, speed: 30, hp_max: 80, alignment },
    });
  const hp = (alignment: string, live: unknown) =>
    readRulesetLive(definition, build(alignment), live).pools.find((pool) => pool.key === "hp")!.value;

  // ── On a sheet ──
  {
    const touch = (alignment: string) =>
      rulesetItemTouchHarm({ definition, item: talisman, user: { build: build(alignment), live: {} }, roll: () => 3 });
    const evil = touch("Lawful Evil")!;
    assert.equal(evil.amount, 24);
    assert.equal(evil.type, "radiant");
    assert.equal(hp("Lawful Evil", evil.live), 56);
    assert.equal(touch("True Neutral")!.amount, 18);
    assert.equal(touch("Neutral Good"), null);
  }

  // ── Through the inventory ──
  {
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/fivee-touch-harms",
      version: 1,
      sourceKind: "local",
      definition: JSON.stringify({ ...doc, id: "fivee-touch-harms" }),
    });
    const chats = createChatsStorage(db);
    const states = createGameStateStorage(db);
    const chat = await chats.create({ name: "Touch harms", mode: "game", characterIds: [] });
    const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The vault." });
    await chats.patchMetadata(chat.id, {
      gameRuleset: { id: "local/fivee-touch-harms", version: 1, packageId: null, options: {} },
      gameCharacterCards: [
        { name: "Knight", rulesetSheet: { v: 1, build: build("Lawful Evil") } },
        { name: "Saint", rulesetSheet: { v: 1, build: build("Lawful Good") } },
      ],
      gameInventory: [],
    });
    await states.create({
      chatId: chat.id,
      messageId: message.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
      rulesetLive: {},
    } as never);
    const ops = (body: unknown[]) =>
      app.inject({ method: "POST", url: "/game/inventory", payload: { chatId: chat.id, ops: body } });
    const liveOf = async (name: string) => {
      const row = await states.getByChatAndMessage(chat.id, message.id, 0);
      const stored = typeof row!.rulesetLive === "string" ? JSON.parse(row!.rulesetLive) : row!.rulesetLive;
      return (stored as Record<string, RulesetLiveState>)[name] ?? {};
    };
    const added = await ops([
      { op: "add", name: "Talisman of Pure Good", item: "kit/talisman", count: 1, holder: "Knight" },
    ]);
    assert.equal(added.statusCode, 200, added.body);
    const knightHp = hp("Lawful Evil", await liveOf("knight"));
    assert.ok(knightHp >= 80 - 48 && knightHp <= 80 - 8, `8d6 off 80, now ${knightHp}`);
    const meta = (await chats.getById(chat.id))!.metadata as Record<string, any>;
    const journal = typeof meta === "string" ? JSON.parse(meta).gameJournal : meta.gameJournal;
    assert.ok(
      (journal?.entries ?? []).some(
        (entry: { title: string; content: string }) =>
          entry.title === "Talisman of Pure Good harms Knight" && /took \d+ radiant damage/.test(entry.content),
      ),
      JSON.stringify(journal?.entries),
    );
    // Given on to the saint: nothing.
    const stacks = (typeof meta === "string" ? JSON.parse(meta) : meta).gameInventory as Array<{ id: string }>;
    const given = await ops([{ op: "give", id: stacks[0]!.id, to: "Saint" }]);
    assert.equal(given.statusCode, 200, given.body);
    assert.equal(hp("Lawful Good", await liveOf("saint")), 80);
    assert.equal(hp("Lawful Evil", await liveOf("knight")), knightHp, "the knight is not burned again");
  }

  // ── Refused ──
  refused(fiveE([{ needs: lines[0]!.needs, type: "radiant" }]), /What it deals names dice, a flat amount, or both/);
  refused(fiveE([{ dice: "1d6", type: "holy" }]), /Unknown damage type "holy"/);
  refused(fiveE([{ dice: "1d6", needsAny: true }]), /"needsAny" says how "needs" is met/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item that harms whoever it comes into the hands of (touchHarms) requires schemaVersion 2 and capabilityApi 1.701 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(700) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(701) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(700) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Touch harms: the Talisman burns the evil knight who takes it up, not the saint; gated at 1.701.");
} finally {
  await app.close();
  closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
