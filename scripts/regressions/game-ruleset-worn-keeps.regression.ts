/**
 * What lasts while an item is worn (Capability API 1.664): 5e's Armor of Invulnerability, "immune to
 * nonmagical damage for 10 minutes or until you are no longer wearing the armor".
 *
 *   - Used out of a fight, the sheet remembers which stack keeps the condition on.
 *   - Taken off through the inventory, the condition comes off the sheet with it; put back on, it is
 *     not back.
 *   - A fight that starts with the item off does not bring the condition in.
 *   - Used in a fight, the condition remembers its stack, and the sheet does once the fight is over.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetLiveWornOff,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-worn-keeps-"));
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
  assert.ok(supportedCapabilityApi.minor >= 664);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (applies: Record<string, unknown> = { whileItemWorn: true }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "invulnerable", label: "Invulnerable" });
    doc.combat.conditions.push({ condition: "invulnerable", effects: [] });
    doc.items = {
      categories: [{ id: "armor", label: "Armor" }],
      slots: [{ id: "body", label: "Body", count: 1 }],
    };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "invulnerability",
          label: "Armor of Invulnerability",
          item: {
            category: "armor",
            slots: { body: 1 },
            use: {
              kind: "buff",
              budget: "action",
              label: "Invulnerable",
              targets: "self",
              applies: [{ condition: "invulnerable", duration: "until-dispelled", ...applies }],
            },
          },
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const doc = fiveE();
  const definition = parsed(doc);
  const armor = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const entries = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries as RulesetCatalogEntry[]]] : [],
    ),
  );
  const book = rulesetItemBook(definition, entries);
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    fields: { level: 9, ac: 18, speed: 30, hp_max: 80 },
  });
  const stack = (equipped: boolean) => ({
    id: "st-armor",
    name: "Armor of Invulnerability",
    item: "kit/invulnerability",
    quantity: 1,
    ...(equipped ? { equipped: true } : {}),
  });

  // ── Used out of a fight: the sheet remembers the stack ──
  let kept: RulesetLiveState;
  {
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks: [stack(true)],
      stackId: "st-armor",
      user: { name: "Knight", build, live: {} },
      roll: () => 1,
    });
    assert.ok(used.ok, used.ok ? "" : used.reason);
    kept = used.live;
    assert.deepEqual(kept.conditions, ["invulnerable"]);
    assert.deepEqual(kept.wornFrom, { invulnerable: "st-armor" });
    // Worn still, it stays; not worn, it comes off.
    assert.deepEqual(rulesetLiveWornOff(kept, new Set(["st-armor"])).off, []);
    const off = rulesetLiveWornOff(kept, new Set());
    assert.deepEqual(off.off, ["invulnerable"]);
    assert.deepEqual(off.live.conditions, []);
    assert.equal(
      readRulesetLive(definition, build, off.live).conditions.find((one) => one.active),
      undefined,
    );
  }

  // ── A fight that starts with it off ──
  const held = (worn: boolean): RulesetSheetItem => ({
    item: armor,
    quantity: 1,
    worn,
    name: "Armor of Invulnerability",
    stack: { id: "st-armor", ref: "kit/invulnerability" },
  });
  const fight = (worn: boolean, live: RulesetLiveState) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "knight", name: "Knight", side: "party", build, live, items: [held(worn)] },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["knight", "foe"];
    state.turn = 0;
    return state;
  };
  {
    const sheetConditions = (worn: boolean) =>
      (rulesetCombatant(fight(worn, kept), "knight")!.sheet!.live as RulesetLiveState).conditions ?? [];
    assert.deepEqual(sheetConditions(true), ["invulnerable"], "worn, it comes into the fight");
    assert.deepEqual(sheetConditions(false), [], "taken off before, it does not");
  }

  // ── Used in a fight: the condition remembers its stack, and the sheet keeps it after ──
  {
    const state = fight(true, {});
    const option = rulesetCombatOptions(definition, state, "knight").find((one) => /Invulnerable/.test(one.label));
    assert.ok(option, JSON.stringify(rulesetCombatOptions(definition, state, "knight").map((one) => one.label)));
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "knight", optionId: option.id, targetIds: ["knight"] },
      () => 10,
    );
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    const knight = rulesetCombatant(result.state, "knight")!;
    const entry = knight.tracked.find((one) => one.condition === "invulnerable");
    assert.equal(entry?.wornItem, "st-armor", JSON.stringify(knight.tracked));
    liftRulesetFightEffects(definition, result.state);
    assert.deepEqual((knight.sheet!.live as RulesetLiveState).wornFrom, { invulnerable: "st-armor" });
  }

  // ── Through the inventory: taken off, it comes off the sheet ──
  {
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/fivee-worn-keeps",
      version: 1,
      sourceKind: "local",
      definition: JSON.stringify({ ...doc, id: "fivee-worn-keeps" }),
    });
    const chats = createChatsStorage(db);
    const states = createGameStateStorage(db);
    const chat = await chats.create({ name: "Worn keeps", mode: "game", characterIds: [] });
    const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The keep." });
    await chats.patchMetadata(chat.id, {
      gameRuleset: { id: "local/fivee-worn-keeps", version: 1, packageId: null, options: {} },
      gameCharacterCards: [{ name: "Knight", rulesetSheet: { v: 1, build } }],
      gameInventory: [stack(true)],
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
      rulesetLive: { knight: kept },
    } as never);
    const ops = (body: unknown[]) =>
      app.inject({ method: "POST", url: "/game/inventory", payload: { chatId: chat.id, ops: body } });
    const liveNow = async () => {
      const row = await states.getByChatAndMessage(chat.id, message.id, 0);
      const stored = typeof row!.rulesetLive === "string" ? JSON.parse(row!.rulesetLive) : row!.rulesetLive;
      return (stored as Record<string, RulesetLiveState>).knight!;
    };
    assert.deepEqual((await liveNow()).conditions, ["invulnerable"]);
    const off = await ops([{ op: "unequip", id: "st-armor" }]);
    assert.equal(off.statusCode, 200, off.body);
    const after = await liveNow();
    assert.ok(!(after.conditions ?? []).includes("invulnerable"), JSON.stringify(after));
    assert.equal(after.wornFrom, undefined);
    const on = await ops([{ op: "equip", id: "st-armor" }]);
    assert.equal(on.statusCode, 200, on.body);
    assert.ok(!((await liveNow()).conditions ?? []).includes("invulnerable"), "not back");
  }

  // ── Refused on a catalog entry's own effects ──
  refused(
    (() => {
      const document = fiveE();
      document.catalogs.push({
        id: "boons",
        label: "Boons",
        feeds: ["spells"],
        entries: [
          {
            id: "boon",
            label: "Boon",
            rows: [{ list: "spells", values: { name: "Boon", level: 1, prepared: true } }],
            mechanics: {
              kind: "buff",
              budget: "action",
              targets: "self",
              applies: [{ condition: "invulnerable", duration: "until-dispelled", whileItemWorn: true }],
            },
          },
        ],
      });
      return document;
    })(),
    /"whileItemWorn" is for what an item's use puts on/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that lasts while the item that put it on is worn (an applied condition's whileItemWorn) requires schemaVersion 2 and capabilityApi 1.664 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(663) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(664) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(663) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Worn keeps: Armor of Invulnerability's condition remembers its stack, comes off when the armor does (inventory, fight start), and is kept through a fight; gated at 1.664.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
