/**
 * A ruleset's items in the Engine's own Classic and Tactical battles (#6905, slice I8-1).
 *
 *   - An item's `use` is its fight effect: heal, harm, a condition by its own name, used up or kept,
 *     on the combat bridge's scale. Nothing the Engine could do, charges and a gate: not offered.
 *   - A battle offers the ruleset's items only with an effect, and the rest while native items are on;
 *     a guess is never kept for one of the ruleset's items.
 *   - A ruleset heal heals by its own strength; a guessed heal still goes by its name.
 *   - The encounter's start asks the model only about the other items, the director works the effects
 *     out itself, and the Classic round route refuses an item the battle does not offer and puts the
 *     worked-out effect on one of the ruleset's.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryOps,
  defaultRulesetSheetBuild,
  gameFightItems,
  gameFightOffers,
  gameInventoryFightLines,
  parseRulesetDefinition,
  rulesetItemBook,
  rollRulesetItemGate,
  rulesetItemFightEffect,
  type CombatItemEffect,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-classic-items-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameEngineStateStorage } =
  await import("../../packages/server/src/services/storage/game-engine-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { resolveCombatRound } = await import("../../packages/server/src/services/game/combat.service.js");
const { loadGameFightItems, loadGameInventoryItemBook } =
  await import("../../packages/server/src/services/game/game-inventory.service.js");
const { combatBlueprintCutOff, encounterRoutes } = await import("../../packages/server/src/routes/encounter.routes.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const { combatDirectorRoutes, COMBAT_DIRECTOR_NAMESPACE } =
  await import("../../packages/server/src/routes/combat-director.routes.js");

let replyText = "{}";
let replyFinish = "stop";
let asked = 0;
const bodies: Array<Record<string, unknown>> = [];
let prompt = "";
const provider = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  prompt = JSON.stringify(JSON.parse(raw).messages);
  asked++;
  bodies.push(JSON.parse(raw));
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      id: "local-proof",
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content: replyText }, finish_reason: replyFinish }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
  );
});
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(encounterRoutes, { prefix: "/encounter" });
await app.register(gameRoutes, { prefix: "/game" });
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });
await app.register(combatDirectorRoutes, { prefix: "/combat", chooseBoss: async () => "" });

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  /** Ember Roads with two more things to use in a fight, and without the fights it resolves itself (and
   *  so its bestiary), so its battles are the Engine's own. */
  const emberDoc = variant(emberText, (doc) => {
    delete doc.combat;
    doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
    const outfitter = doc.catalogs.find((catalog: { id: string }) => catalog.id === "outfitter");
    outfitter.entries.push(
      {
        id: "firepot",
        label: "Firepot",
        item: {
          category: "gear",
          use: {
            kind: "attack",
            targets: "enemy",
            amount: { dice: "2d6" },
            damageType: "fire",
            applies: [{ condition: "shaken", duration: { rounds: 3 } }],
            consumes: true,
          },
        },
      },
      {
        id: "war-horn",
        label: "War horn",
        item: { category: "gear", use: { kind: "buff", targets: "ally" } },
      },
    );
  });
  const ember = parsedOrThrow(emberDoc, "Ember Roads for the Engine's own battles");
  const emberBook = rulesetItemBook(ember, entriesOf(ember));
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const graveBook = rulesetItemBook(gravewatch, entriesOf(gravewatch));
  const effectOf = (book: typeof emberBook, item: string, name = book.itemOf(item)!.name) =>
    rulesetItemFightEffect(name, book.itemOf(item));

  // ── An item's use is its fight effect ──
  {
    assert.deepEqual(effectOf(emberBook, "outfitter/poultice"), {
      name: "Poultice",
      target: "ally",
      type: "heal",
      description: "heals 1d4 + 1, range 0",
      // 1d4 + 1 is 3.5 on average: half a typical hit, and a typical hit is 0.22 of a maximum.
      power: 0.11,
      consumes: true,
      ruleset: true,
    });
    assert.deepEqual(effectOf(emberBook, "outfitter/firepot"), {
      name: "Firepot",
      target: "enemy",
      type: "damage",
      description: "2d6 fire, Shaken",
      power: 0.22,
      element: "fire",
      status: { name: "Shaken", emoji: "💢", duration: 3 },
      consumes: true,
      ruleset: true,
    });
    // A buff is its status alone, kept rather than used up.
    assert.deepEqual(effectOf(emberBook, "outfitter/war-horn"), {
      name: "War horn",
      target: "ally",
      type: "buff",
      description: "War horn",
      consumes: false,
      ruleset: true,
    });
    // Under the name the fight lists it by.
    assert.equal(effectOf(emberBook, "outfitter/poultice", "Poultice (Green)")?.name, "Poultice (Green)");
    // A heal of one is as little as an effect goes, a twentieth.
    assert.equal(effectOf(graveBook, "kit/warming-tonic")?.power, 0.05);
    // Charges, a gate, no use at all: not in the Engine's own battles.
    // Charges and a gate (#6909): the bell spends its charges and is kept, used only worn and bound;
    // the page says the check it asks first.
    assert.deepEqual(effectOf(graveBook, "kit/dawn-bell"), {
      name: "Dawn bell",
      target: "enemy",
      type: "debuff",
      description: "Steel 7 save negates it, Rattled, spends 1 of 3 charges",
      status: { name: "Rattled", emoji: "💢", duration: 2 },
      consumes: false,
      charges: { cost: 1, max: 3 },
      wear: { equipped: true, bound: true },
      ruleset: true,
    });
    assert.equal(
      effectOf(graveBook, "kit/litany-page")?.description,
      "restores 2 Resolve, needs a Ward check against 2 first, unless Nerve is 3 or more; failed, it is used up for nothing",
    );
    assert.equal(effectOf(emberBook, "outfitter/leather-coat"), null);
    assert.equal(rulesetItemFightEffect("Nothing", undefined), null);
    // Crafted uses, one part at a time.
    const withUse = (use: Record<string, unknown>) => {
      const definition = parsedOrThrow(
        variant(JSON.stringify(emberDoc), (doc) => {
          doc.catalogs.find((catalog: { id: string }) => catalog.id === "outfitter").entries[0].item.use = use;
        }),
        `a hand axe used as ${JSON.stringify(use)}`,
      );
      return rulesetItemFightEffect(
        "Hand axe",
        rulesetItemBook(definition, entriesOf(definition)).itemOf("outfitter/hand-axe"),
      );
    };
    assert.equal(withUse({ kind: "heal", targets: "self" }), null, "a heal with no amount does nothing here");
    assert.equal(withUse({ kind: "attack", targets: "enemy" }), null, "nor an attack with nothing");
    assert.deepEqual(
      withUse({ kind: "attack", applies: [{ condition: "pinned", duration: "instant" }] }),
      {
        name: "Hand axe",
        target: "enemy",
        type: "status",
        description: "Pinned",
        status: { name: "Pinned", emoji: "💢", duration: 2 },
        consumes: false,
        // An axe is held in the hands, so it is used only while held.
        wear: { equipped: true },
        ruleset: true,
      },
      "an attack that only puts a condition on is a status, for two rounds without its own",
    );
    assert.equal(withUse({ kind: "heal", targets: "any", amount: { flat: 100 } })?.power, 1, "at most all of it");
    assert.equal(withUse({ kind: "heal", targets: "any", amount: { flat: 100 } })?.target, "any");
    assert.equal(withUse({ kind: "debuff" })?.target, "enemy");
    assert.equal(withUse({ kind: "debuff" })?.power, undefined, "a debuff is its status alone");
    assert.equal(withUse({ kind: "buff", amount: { flat: 7 } })?.power, undefined, "and so is a buff");
  }

  // ── Which items a battle offers ──
  {
    const stacks: GameInventoryStack[] = [
      { id: "s1", name: "Rope", quantity: 1 },
      { id: "s2", name: "Poultice", quantity: 3, item: "outfitter/poultice" },
      { id: "s3", name: "Leather coat", quantity: 1, item: "outfitter/leather-coat" },
      { id: "s4", name: "Firepot", quantity: 2, item: "outfitter/firepot", holder: "Bram" },
    ];
    const guess = (name: string, extra: Partial<CombatItemEffect> = {}): CombatItemEffect => ({
      name,
      target: "ally",
      type: "heal",
      description: "guessed",
      power: 2,
      ...extra,
    });
    const guessed = [
      guess("Rope", { type: "utility" }),
      guess("Poultice"),
      guess("Leather coat"),
      guess("Stone", { ruleset: true }),
    ];
    const on = gameFightItems(stacks, emberBook, true, guessed);
    assert.deepEqual(
      on.lines.map((line) => line.name),
      ["Rope", "Poultice", "Firepot"],
      "a plain item and the ruleset's usable ones; the coat has no use",
    );
    assert.deepEqual(
      on.effects.map((effect) => [effect.name, effect.description]),
      [
        ["Poultice", "heals 1d4 + 1, range 0"],
        ["Firepot", "2d6 fire, Shaken"],
        ["Rope", "guessed"],
      ],
      "the guesses for the ruleset's items, and one that claims to be the ruleset's, are gone",
    );
    const off = gameFightItems(stacks, emberBook, false, guessed);
    assert.deepEqual(
      off.lines.map((line) => line.name),
      ["Poultice", "Firepot"],
      "native items off: only the ruleset's usable items",
    );
    assert.deepEqual(
      off.effects.map((effect) => effect.name),
      ["Poultice", "Firepot"],
    );
    // No book: every item is guessed at, as before, but a guess never passes for the ruleset's.
    const none = gameFightItems(stacks, undefined, true, guessed);
    assert.deepEqual(
      none.lines.map((line) => line.name),
      ["Rope", "Poultice", "Leather coat", "Firepot"],
    );
    assert.deepEqual(
      none.effects.map((effect) => effect.name),
      ["Rope", "Poultice", "Leather coat"],
    );
  }

  // ── A plain item that shares a ruleset item's name keeps its own guess, in either order ──
  {
    const guess: CombatItemEffect = { name: "Poultice", target: "enemy", type: "damage", description: "guessed" };
    for (const [first, second] of [
      ["plain", "ruleset"],
      ["ruleset", "plain"],
    ]) {
      const stacks = [first, second].map((kind, index): GameInventoryStack =>
        kind === "plain"
          ? { id: `p${index}`, name: "Poultice", quantity: 1 }
          : { id: `r${index}`, name: "Poultice", quantity: 1, item: "outfitter/poultice" },
      );
      const fight = gameFightItems(stacks, emberBook, true, [guess]);
      const effectOfLine = (item: string | undefined) => {
        const line = fight.lines.find((each) => each.item === item)!;
        return fight.effects.find((effect) => effect.name === line.name)?.description;
      };
      assert.equal(effectOfLine(undefined), "guessed", `${first} first: the plain poultice keeps the guess`);
      assert.equal(effectOfLine("outfitter/poultice"), "heals 1d4 + 1, range 0", `${first} first`);
      assert.equal(fight.effects.length, 2, `${first} first: nothing else`);
    }
  }

  // ── Charges and gates (#6909) ──
  {
    const bell = (id: string, extra: Partial<GameInventoryStack> = {}): GameInventoryStack => ({
      id,
      name: "Dawn bell",
      quantity: 1,
      item: "kit/dawn-bell",
      equipped: true,
      bound: true,
      ...extra,
    });
    const effects = [effectOf(graveBook, "kit/dawn-bell")!];
    const uses = (stacks: GameInventoryStack[]) =>
      gameFightOffers(stacks, effects, { native: true }).map((line) => [line.name, line.quantity]);
    // Counted in uses, from the stacks worn and bound, a stack without a count full.
    assert.deepEqual(uses([bell("b1", { charges: 2 })]), [["Dawn bell", 2]]);
    assert.deepEqual(uses([bell("b1")]), [["Dawn bell", 3]]);
    assert.deepEqual(uses([bell("b1", { charges: 1 }), bell("b2", { charges: 2, holder: "Bram" })]), [
      ["Dawn bell", 3],
    ]);
    assert.deepEqual(uses([bell("b1", { charges: 0 })]), [], "none left, not offered");
    assert.deepEqual(uses([bell("b1", { bound: false })]), [], "not bound, not offered");
    assert.deepEqual(uses([bell("b1", { equipped: false })]), [], "not worn, not offered");
    assert.deepEqual(uses([bell("b1", { charges: 9 })]), [["Dawn bell", 3]], "never more than it holds");
    // A bell that reads its most off a stat it does not give holds a count nobody can say: not offered.
    const uncounted = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "kit")
          .entries.find((entry: { id: string }) => entry.id === "dawn-bell").item.charges.max = { stat: "target" };
      }),
      "a bell that counts by a stat it does not give",
    );
    assert.equal(
      rulesetItemFightEffect("Dawn bell", rulesetItemBook(uncounted, entriesOf(uncounted)).itemOf("kit/dawn-bell")),
      null,
    );
    // Nor is a page whose check reads its difficulty off a stat it does not give: nobody can say it.
    const unsaid = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "kit")
          .entries.find((entry: { id: string }) => entry.id === "litany-page").item.use.gate.difficulty = {
          stat: "target",
        };
      }),
      "a page whose check reads a stat it does not give",
    );
    assert.equal(
      rulesetItemFightEffect(
        "Page of the vigil litany",
        rulesetItemBook(unsaid, entriesOf(unsaid)).itemOf("kit/litany-page"),
      ),
      null,
    );
    // A worn item used up counts only the worn ones.
    const wornTonic = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const tonic = doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "kit")
          .entries.find((entry: { id: string }) => entry.id === "warming-tonic");
        tonic.item.slots = { worn: 1 };
      }),
      "a tonic worn to be drunk",
    );
    const wornBook = rulesetItemBook(wornTonic, entriesOf(wornTonic));
    assert.deepEqual(
      gameFightOffers(
        [
          { id: "t1", name: "Warming tonic", quantity: 1, item: "kit/warming-tonic", equipped: true },
          { id: "t2", name: "Warming tonic", quantity: 3, item: "kit/warming-tonic" },
        ],
        [rulesetItemFightEffect("Warming tonic", wornBook.itemOf("kit/warming-tonic"))!],
        { native: true },
      ).map((line) => line.quantity),
      [1],
    );
    // And a fight drinks the worn one, never one from the bag before it; anything else takes the first.
    const drink = (worn: boolean) =>
      applyGameInventoryOps(
        [
          { id: "t2", name: "Warming tonic", quantity: 3, item: "kit/warming-tonic" },
          { id: "t1", name: "Warming tonic", quantity: 1, item: "kit/warming-tonic", equipped: true },
        ],
        [{ op: "take", name: "Warming tonic", count: 1, as: "used", ...(worn ? { worn: true as const } : {}) }],
        undefined,
        wornBook,
      ).stacks.map((stack) => [stack.id, stack.quantity]);
    assert.deepEqual(drink(true), [["t2", 3]], "a fight drinks the worn one");
    assert.deepEqual(
      drink(false),
      [
        ["t2", 2],
        ["t1", 1],
      ],
      "anything else takes the first",
    );

    // Spending: a use off the player's own stack first; the last charge rolls its die, and a 1 breaks it.
    const charge = (stacks: GameInventoryStack[], count: number, faces: number[] = [20], holder?: string) => {
      let at = 0;
      return applyGameInventoryOps(
        stacks,
        [{ op: "charge", name: "Dawn bell", count, ...(holder !== undefined ? { from: { holder } } : {}) }],
        undefined,
        graveBook,
        (sides) => Math.min(sides, faces[Math.min(at++, faces.length - 1)]!),
      );
    };
    const two = [bell("b2", { charges: 2, holder: "Bram" }), bell("b1", { charges: 2 })];
    const once = charge(two, 1);
    assert.deepEqual(
      once.stacks.map((stack) => [stack.id, stack.charges]),
      [
        ["b2", 2],
        ["b1", 1],
      ],
      "the player's own first",
    );
    assert.deepEqual(once.results, [{ ok: true, count: 1 }]);
    assert.deepEqual(once.journal, [{ item: "Dawn bell", action: "used", quantity: 1 }]);
    const emptied = charge([bell("b1", { charges: 1 })], 1, [20]);
    assert.deepEqual(
      emptied.stacks.map((stack) => stack.charges),
      [0],
      "emptied, it rolls and holds",
    );
    const broken = charge([bell("b1", { charges: 1 })], 1, [1]);
    assert.deepEqual(broken.stacks, [], "a 1 on its d20 breaks it");
    assert.deepEqual(broken.results, [{ ok: true, count: 1, broke: 1 }]);
    assert.deepEqual(broken.journal, [
      { item: "Dawn bell", action: "used", quantity: 1 },
      { item: "Dawn bell", action: "lost", quantity: 1 },
    ]);
    assert.deepEqual(
      applyGameInventoryOps(
        [bell("b1", { charges: 1 })],
        [{ op: "charge", name: "Dawn bell", count: 1 }],
        undefined,
        graveBook,
      ).stacks.map((stack) => stack.charges),
      [0],
      "without dice nothing breaks",
    );
    assert.deepEqual(
      charge(two, 3).stacks.map((stack) => [stack.id, stack.charges]),
      [
        ["b2", 1],
        ["b1", 0],
      ],
      "then the party's, when the player's runs out",
    );
    assert.deepEqual(
      charge(two, 1, [20], "Bram").stacks.map((stack) => stack.charges),
      [1, 2],
      "from one bag",
    );
    assert.deepEqual(charge([bell("b1", { charges: 0 })], 1).results, [{ ok: false, reason: "none-held" }]);
    assert.deepEqual(
      charge([bell("b1", { bound: false })], 1).results,
      [{ ok: false, reason: "none-held" }],
      "not bound",
    );
    assert.deepEqual(charge([bell("b1", { charges: 1 })], 5).results, [{ ok: true, count: 1 }], "as many as there are");

    // A gate rolled for its user: skipped when their Nerve is 3, a failure for two dice showing ones.
    const page = graveBook.itemOf("kit/litany-page")!.entry.item!;
    const user = (nerve: number) => ({
      build: { ...defaultRulesetSheetBuild(gravewatch), abilities: { sinew: 2, nerve, warmth: 2 } },
      live: undefined,
    });
    const gate = (nerve: number, face: number) =>
      rollRulesetItemGate({
        definition: gravewatch,
        itemOf: graveBook.itemOf,
        stacks: [],
        holder: undefined,
        item: page,
        user: user(nerve),
        roll: () => face,
      });
    assert.equal(gate(3, 1), null, "unless holds");
    assert.deepEqual(gate(2, 1), { check: "Ward", total: 0, difficulty: 2, success: false, rolls: [1, 1] });
    assert.equal(gate(2, 8)?.success, true);
  }

  // ── A ruleset heal heals by its own strength ──
  {
    const hero = {
      id: "hero",
      name: "Hero",
      side: "player" as const,
      hp: 20,
      maxHp: 100,
      mp: 0,
      maxMp: 0,
      attack: 10,
      defense: 5,
      speed: 5,
      level: 1,
    };
    const foe = { ...hero, id: "foe", name: "Foe", side: "enemy" as const, hp: 100 };
    const healed = (itemEffect: CombatItemEffect, itemId = "Poultice") => {
      const result = resolveCombatRound(
        [structuredClone(hero), structuredClone(foe)],
        1,
        "normal",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { actorId: "hero", defendingIds: new Set(), action: { type: "item", itemId, targetId: "hero", itemEffect } },
      );
      return result.actions.find((action) => action.skillName === itemId)!.remainingHp - hero.hp;
    };
    const poultice = effectOf(emberBook, "outfitter/poultice")!;
    assert.equal(healed(poultice), 11, "0.11 of 100");
    assert.equal(healed({ ...poultice, power: 0.5 }), 50);
    const { ruleset: _ruleset, ...guessedHeal } = poultice;
    assert.equal(healed({ ...guessedHeal, power: 0.9 }), 30, "a guessed heal still goes by its name");
    assert.equal(healed({ ...guessedHeal, power: 0.9 }, "Minor tonic"), 20);
  }

  // ── Through the routes ──
  const chats = createChatsStorage(db);
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const connection = await createConnectionsStorage(db).create({
    name: "Local encounter fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture-model",
    treatAsLocalEndpoint: true,
  });
  const pin = async (id: string, document: Record<string, unknown>, definition: RulesetDefinition) => {
    await createGameRulesetsStorage(db).put({
      rulesetId: `local/${id}`,
      version: definition.version,
      sourceKind: "local",
      definition: JSON.stringify({ ...document, id }),
    });
    return { id: `local/${id}`, version: definition.version, packageId: null, options: {} };
  };
  const emberPin = await pin("ember-classic-items", emberDoc, ember);
  const closedDoc = variant(JSON.stringify(emberDoc), (doc) => (doc.items.native = false));
  const closedPin = await pin("ember-classic-closed", closedDoc, parsedOrThrow(closedDoc, "Ember with native off"));
  const bags: GameInventoryStack[] = [
    { id: "s1", name: "Rope", quantity: 1 },
    { id: "s2", name: "Poultice", quantity: 3, item: "outfitter/poultice" },
    { id: "s3", name: "Leather coat", quantity: 1, item: "outfitter/leather-coat" },
  ];
  const newGame = async (gameRuleset: unknown) => {
    const chat = await chats.create({ name: "Classic", mode: "game", characterIds: [], connectionId: connection.id });
    const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
    await chats.patchMetadata(chat.id, {
      gameRuleset,
      gameSetupConfig: { combatDirector: true, difficulty: "Normal" },
      gameInventory: bags,
    });
    await createGameStateStorage(db).create({
      chatId: chat.id,
      messageId: anchor.id,
      swipeIndex: 0,
      date: "",
      time: "",
      location: "road",
      weather: "",
      temperature: "",
      presentCharacters: [],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
    });
    return { chatId: chat.id, anchor: anchor.id };
  };

  // The server's own reading.
  {
    const game = await newGame(emberPin);
    const meta = JSON.parse((await chats.getById(game.chatId))!.metadata as string);
    const fight = await loadGameFightItems(db, meta, [
      { name: "Poultice", target: "enemy", type: "damage", description: "forged", power: 2.5 },
    ]);
    assert.deepEqual(
      fight.lines.map((line) => line.name),
      ["Rope", "Poultice"],
    );
    assert.equal(fight.effects.find((effect) => effect.name === "Poultice")?.type, "heal", "never the screen's");
    const plain = await newGame(null);
    const plainMeta = JSON.parse((await chats.getById(plain.chatId))!.metadata as string);
    assert.deepEqual(
      (await loadGameFightItems(db, plainMeta, [])).lines.map((line) => line.name),
      ["Rope", "Poultice", "Leather coat"],
      "a game without a ruleset offers every item",
    );
  }

  // The encounter's start: the model is told which items to leave alone, and its guesses for them go.
  {
    const game = await newGame(emberPin);
    replyText = JSON.stringify({
      party: [{ name: "Hero" }],
      enemies: [{ name: "Rat" }],
      itemEffects: [
        { name: "Rope", target: "enemy", type: "status", description: "tangles", power: 0.2 },
        { name: "Poultice", target: "enemy", type: "damage", description: "guessed", power: 2 },
      ],
    });
    const started = await app.inject({
      method: "POST",
      url: "/encounter/init",
      payload: { chatId: game.chatId, settings: {} },
    });
    assert.equal(started.statusCode, 200, started.body);
    assert.match(prompt, /already says what these items do, so give no itemEffects for them: Poultice, Leather coat\./);
    const effects = started.json().combatState.itemEffects as CombatItemEffect[];
    assert.deepEqual(
      effects.map((effect) => [effect.name, effect.description, effect.ruleset ?? false]),
      [
        ["Poultice", "heals 1d4 + 1, range 0", true],
        ["Rope", "tangles", false],
      ],
    );
    const closed = await newGame(closedPin);
    const closedStart = await app.inject({
      method: "POST",
      url: "/encounter/init",
      payload: { chatId: closed.chatId, settings: {} },
    });
    assert.equal(closedStart.statusCode, 200, closedStart.body);
    assert.match(prompt, /says what its own items do in a fight, so give no itemEffects/);
    assert.doesNotMatch(prompt, /itemEffects\\": \[/);
    assert.deepEqual(
      (closedStart.json().combatState.itemEffects as CombatItemEffect[]).map((effect) => effect.name),
      ["Poultice"],
    );
  }

  // A setup cut off before it finished says so (playtest B1): the provider ran out of room, or the JSON
  // stops part way, and either way the screen is told it was cut off rather than that it failed.
  {
    assert.equal(combatBlueprintCutOff("length", '{"party": []}'), true, "the provider says it ran out");
    assert.equal(combatBlueprintCutOff("stop", '{"party": [{"name": "Get up onto the pili'), true, "inside a string");
    assert.equal(combatBlueprintCutOff("stop", '```json\n{"party": [{"name": "A"}],'), true, "an object left open");
    assert.equal(combatBlueprintCutOff("stop", '{"party": [{"name": "A \\"B\\" {"}]}'), false, "a whole answer");
    assert.equal(combatBlueprintCutOff("stop", '```json\n{"party": []}\n```'), false, "fenced and whole");
    assert.equal(combatBlueprintCutOff("stop", "not json at all"), false, "a refusal is not a cut-off");
    const game = await newGame(emberPin);
    replyText = '{"party": [{"name": "Hero"}], "enemies": [{"name": "Rat", "description": "Get up onto the pili';
    replyFinish = "length";
    asked = 0;
    const cut = await app.inject({
      method: "POST",
      url: "/encounter/init",
      payload: { chatId: game.chatId, settings: {} },
    });
    replyFinish = "stop";
    assert.equal(cut.statusCode, 502, cut.body);
    assert.equal(cut.json().reason, "cut-off");
    assert.match(cut.json().error, /cut off before it finished/);
    assert.equal(asked, 1, "a connection that does not think is not asked again");
    // A connection that thinks hard: the setup thinks at medium at most, and asked again once cut off,
    // not at all.
    const thinker = await createConnectionsStorage(db).create({
      name: "Local thinking fixture",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "fixture-model",
      treatAsLocalEndpoint: true,
    });
    await createConnectionsStorage(db).updateDefaultParameters(thinker.id, { reasoningEffort: "xhigh" });
    replyFinish = "length";
    asked = 0;
    bodies.length = 0;
    const thought = await app.inject({
      method: "POST",
      url: "/encounter/init",
      payload: { chatId: game.chatId, connectionId: thinker.id, settings: {} },
    });
    replyFinish = "stop";
    assert.equal(thought.statusCode, 502, thought.body);
    assert.equal(thought.json().reason, "cut-off");
    assert.equal(asked, 2, "cut off, it is asked once more");
    assert.equal(bodies[0]!.max_tokens, 12000 + 4096, "its own budget, with a medium think's room on top");
    assert.equal(bodies[1]!.reasoning_effort, "none", "and then without thinking");
    assert.equal(bodies[1]!.max_tokens, 12000);
    // Asked twice at once for the same chat (opened again while its setup runs), the model is asked once.
    replyText = JSON.stringify({ party: [{ name: "Hero" }], enemies: [{ name: "Rat" }] });
    asked = 0;
    const both = await Promise.all(
      [0, 1].map(() =>
        app.inject({ method: "POST", url: "/encounter/init", payload: { chatId: game.chatId, settings: {} } }),
      ),
    );
    assert.deepEqual(
      both.map((one) => one.statusCode),
      [200, 200],
    );
    assert.equal(both[0]!.body, both[1]!.body, "the same answer for both");
    assert.equal(asked, 1, "one setup at a time for a chat");
  }

  // The Classic round route: the ruleset's effect, whatever the screen sent; an item the battle does
  // not offer is refused.
  {
    const game = await newGame(emberPin);
    const combatants = [
      {
        id: "hero",
        name: "Hero",
        side: "player",
        hp: 20,
        maxHp: 100,
        mp: 0,
        maxMp: 0,
        attack: 10,
        defense: 5,
        speed: 5,
        level: 1,
      },
      {
        id: "rat",
        name: "Rat",
        side: "enemy",
        hp: 100,
        maxHp: 100,
        mp: 0,
        maxMp: 0,
        attack: 1,
        defense: 1,
        speed: 1,
        level: 1,
      },
    ];
    const round = (playerAction: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: "/game/combat/round",
        payload: { chatId: game.chatId, round: 1, combatants, playerAction },
      });
    const forged = await round({
      type: "item",
      itemId: "Poultice",
      targetId: "hero",
      itemEffect: { name: "Poultice", target: "enemy", type: "damage", description: "forged", power: 2.5 },
    });
    assert.equal(forged.statusCode, 200, forged.body);
    const heal = forged.json().result.actions.find((action: { skillName?: string }) => action.skillName === "Poultice");
    assert.equal(heal.defenderId, "hero");
    assert.equal(heal.isHeal, true);
    assert.equal(heal.finalDamage, 11, "the poultice's own 0.11 of 100, not the forged harm");
    const coat = await round({ type: "item", itemId: "Leather coat", targetId: "hero" });
    assert.equal(coat.statusCode, 400);
    assert.match(coat.body, /That item does nothing in this fight/);
    const missing = await round({ type: "item", itemId: "Elixir", targetId: "hero" });
    assert.equal(missing.statusCode, 400);
    const rope = await round({ type: "item", itemId: "Rope", targetId: "hero" });
    assert.equal(rope.statusCode, 200, "a plain item is used as guessed");
    // A plain item cannot pass for the ruleset's: the mark is not read from the screen, so this heal goes
    // by its name (0.3), not by the forged strength.
    const markedRope = await round({
      type: "item",
      itemId: "Rope",
      targetId: "hero",
      itemEffect: { name: "Rope", target: "ally", type: "heal", description: "forged", power: 1, ruleset: true },
    });
    assert.equal(markedRope.statusCode, 200, markedRope.body);
    assert.equal(
      markedRope.json().result.actions.find((action: { skillName?: string }) => action.skillName === "Rope")
        .finalDamage,
      30,
    );
    // The screen-played Tactical engine heals with whatever it is handed, so it takes only a plain item
    // the battle offers, never one of the ruleset's.
    const tacticalUnit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 30,
      maxHp: 30,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
    });
    const tactical = await app.inject({
      method: "POST",
      url: "/game/combat/tactical/start",
      payload: {
        chatId: game.chatId,
        party: [tacticalUnit("hero", "player")],
        enemies: [tacticalUnit("rat", "enemy")],
        seed: 3,
      },
    });
    assert.equal(tactical.statusCode, 200, tactical.body);
    const tacticalItem = (itemName: string) =>
      app.inject({
        method: "POST",
        url: "/game/combat/tactical/action",
        payload: {
          chatId: game.chatId,
          state: tactical.json().state,
          action: { type: "item", unitId: "hero", itemName, targetId: "hero" },
        },
      });
    for (const refused of ["Poultice", "Leather coat", "Elixir"]) {
      const answer = await tacticalItem(refused);
      assert.equal(answer.statusCode, 400, `${refused}: ${answer.body}`);
      assert.match(answer.body, /That item does nothing in this fight/);
    }
    assert.equal((await tacticalItem("Rope")).statusCode, 200);
    const plainGame = await newGame(null);
    const plainTactical = await app.inject({
      method: "POST",
      url: "/game/combat/tactical/start",
      payload: {
        chatId: plainGame.chatId,
        party: [tacticalUnit("hero", "player")],
        enemies: [tacticalUnit("rat", "enemy")],
        seed: 3,
      },
    });
    const plainTacticalItem = await app.inject({
      method: "POST",
      url: "/game/combat/tactical/action",
      payload: {
        chatId: plainGame.chatId,
        state: plainTactical.json().state,
        action: { type: "item", unitId: "hero", itemName: "Elixir", targetId: "hero" },
      },
    });
    assert.equal(plainTacticalItem.statusCode, 200, "nor is screen-played Tactical");
    const closed = await newGame(closedPin);
    const closedRope = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: { chatId: closed.chatId, round: 1, combatants, playerAction: { type: "item", itemId: "Rope" } },
    });
    assert.equal(closedRope.statusCode, 400, "native items off: a plain item is not offered");
    const closedPoultice = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: {
        chatId: closed.chatId,
        round: 1,
        combatants,
        partyActions: { hero: { type: "item", itemId: "Poultice", targetId: "hero" } },
      },
    });
    assert.equal(closedPoultice.statusCode, 200, "but the ruleset's own poultice is");
    // A game without ruleset items is checked no more than it ever was: an item it does not hold is
    // still used as the screen sent it.
    const plain = await newGame(null);
    const unheld = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: {
        chatId: plain.chatId,
        round: 1,
        combatants,
        playerAction: { type: "item", itemId: "Elixir", targetId: "hero" },
      },
    });
    assert.equal(unheld.statusCode, 200, unheld.body);
  }

  // The combat director works the effects out itself.
  {
    const game = await newGame(emberPin);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const start = await app.inject({
      method: "POST",
      url: "/combat/start",
      payload: {
        chatId: game.chatId,
        anchor: game.anchor,
        style: "classic",
        party: [unit("hero", "Hero", "player")],
        enemies: [unit("rat", "Rat", "enemy")],
        itemEffects: [
          { name: "Poultice", target: "enemy", type: "damage", description: "forged", power: 2.5, ruleset: true },
          { name: "Leather coat", target: "ally", type: "heal", description: "guessed" },
          { name: "Rope", target: "enemy", type: "status", description: "tangles" },
        ],
      },
    });
    assert.equal(start.statusCode, 200, start.body);
    assert.deepEqual(
      (start.json().session as { inventory: Array<{ name: string }> }).inventory.map((line) => line.name),
      ["Rope", "Poultice"],
    );
    const row = await createGameEngineStateStorage(db).getByChatAndMessage(
      game.chatId,
      game.anchor,
      0,
      COMBAT_DIRECTOR_NAMESPACE,
    );
    const state = JSON.parse(row!.state) as { itemEffects: CombatItemEffect[] };
    assert.deepEqual(
      state.itemEffects.map((effect) => [effect.name, effect.type, effect.description]),
      [
        ["Poultice", "heal", "heals 1d4 + 1, range 0"],
        ["Rope", "status", "tangles"],
      ],
    );
  }

  // ── Charges and gates through the routes (#6909) ──
  {
    // Gravewatch without the fights it resolves itself; the hard copy's page asks more than two dice
    // can ever show.
    const graveNoFights = (edit: (doc: Record<string, any>) => void = () => {}) =>
      variant(gravewatchText, (doc) => {
        delete doc.combat;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
        edit(doc);
      });
    const graveDoc = graveNoFights();
    const gravePin = await pin("grave-classic-items", graveDoc, parsedOrThrow(graveDoc, "Gravewatch for battles"));
    const hardDoc = graveNoFights((doc) => {
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "kit")
        .entries.find((entry: { id: string }) => entry.id === "litany-page").item.use.gate.difficulty = 100;
    });
    const hardPin = await pin("grave-classic-hard", hardDoc, parsedOrThrow(hardDoc, "Gravewatch with a hard page"));
    // The same hard page pinned where it is worn to be read, so a fight counts and spends only a worn one.
    const wornDoc = graveNoFights((doc) => {
      const page = doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "kit")
        .entries.find((entry: { id: string }) => entry.id === "litany-page").item;
      page.use.gate.difficulty = 100;
      page.slots = { worn: 1 };
    });
    const wornPin = await pin("grave-classic-worn", wornDoc, parsedOrThrow(wornDoc, "Gravewatch with a worn page"));
    const ada = (nerve: number) => ({
      name: "Ada",
      rulesetSheet: {
        v: 1,
        build: { ...defaultRulesetSheetBuild(gravewatch), abilities: { sinew: 2, nerve, warmth: 2 } },
      },
    });
    const kit: GameInventoryStack[] = [
      { id: "st-page", name: "Page of the vigil litany", quantity: 2, item: "kit/litany-page" },
      { id: "st-bell", name: "Dawn bell", quantity: 1, item: "kit/dawn-bell", equipped: true, bound: true, charges: 2 },
    ];
    const graveGame = async (gameRuleset: unknown, nerve: number) => {
      const game = await newGame(gameRuleset);
      await chats.patchMetadata(game.chatId, { gameInventory: kit, gameCharacterCards: [ada(nerve)] });
      return game;
    };
    const combatants = [
      {
        id: "ada",
        name: "Ada",
        side: "player",
        hp: 20,
        maxHp: 100,
        mp: 0,
        maxMp: 0,
        attack: 10,
        defense: 5,
        speed: 5,
        level: 1,
      },
      {
        id: "rat",
        name: "Rat",
        side: "enemy",
        hp: 100,
        maxHp: 100,
        mp: 0,
        maxMp: 0,
        attack: 1,
        defense: 1,
        speed: 1,
        level: 1,
      },
    ];
    const pageRound = async (chatId: string) => {
      const answer = await app.inject({
        method: "POST",
        url: "/game/combat/round",
        payload: {
          chatId,
          round: 1,
          combatants,
          playerAction: { type: "item", itemId: "Page of the vigil litany", targetId: "ada" },
        },
      });
      assert.equal(answer.statusCode, 200, answer.body);
      return answer
        .json()
        .result.actions.find((action: { skillName?: string }) => action.skillName === "Page of the vigil litany");
    };
    // Nerve 3: no check, and the page does what it does.
    const read = await pageRound((await graveGame(gravePin, 3)).chatId);
    assert.equal(read.isMiss, false);
    assert.equal(read.note, undefined);
    // Nerve 1, and a page that asks more than the dice can show: the check fails, and it does nothing.
    const failed = await pageRound((await graveGame(hardPin, 1)).chatId);
    assert.equal(failed.isMiss, true);
    assert.match(
      failed.note,
      /^Ada rolls Ward to use Page of the vigil litany: \d+ against \d+, failed, and it is used up for nothing\.$/,
    );
    // A bell with no use left is not offered.
    const silent = await graveGame(gravePin, 3);
    await chats.patchMetadata(silent.chatId, { gameInventory: [{ ...kit[1]!, charges: 0 }] });
    const rung = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: {
        chatId: silent.chatId,
        round: 1,
        combatants,
        playerAction: { type: "item", itemId: "Dawn bell", targetId: "rat" },
      },
    });
    assert.equal(rung.statusCode, 400);

    // The check is rolled for whoever uses the page: Bram (Nerve 1) fails where Ada (Nerve 3) would not.
    const party = await graveGame(hardPin, 3);
    await chats.patchMetadata(party.chatId, {
      gameCharacterCards: [ada(3), { ...ada(1), name: "Bram" }],
    });
    const brams = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: {
        chatId: party.chatId,
        round: 1,
        combatants: [...combatants, { ...combatants[0]!, id: "bram", name: "Bram" }],
        partyActions: { bram: { type: "item", itemId: "Page of the vigil litany", targetId: "bram" } },
      },
    });
    assert.equal(brams.statusCode, 200, brams.body);
    assert.match(
      brams.json().result.actions.find((action: { attackerId: string }) => action.attackerId === "bram").note,
      /^Bram rolls Ward to use Page of the vigil litany: .*failed/,
    );
    // Only the player's own unit falls back on the player's card: Wren, the player, has no card of that
    // name and reads Ada's (Nerve 3, no check); Cleo, a companion with no card, rolls on a blank sheet
    // (Nerve 2) and fails.
    const wren = await createCharactersStorage(db).createPersona("Wren", "The player");
    await chats.update(party.chatId, { personaId: wren.id });
    const mixed = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: {
        chatId: party.chatId,
        round: 1,
        combatants: [
          ...combatants,
          { ...combatants[0]!, id: "wren", name: "Wren" },
          { ...combatants[0]!, id: "cleo", name: "Cleo" },
        ],
        partyActions: {
          wren: { type: "item", itemId: "Page of the vigil litany", targetId: "wren" },
          cleo: { type: "item", itemId: "Page of the vigil litany", targetId: "cleo" },
        },
      },
    });
    assert.equal(mixed.statusCode, 200, mixed.body);
    const actionOf = (id: string) =>
      mixed.json().result.actions.find((action: { attackerId: string }) => action.attackerId === id);
    assert.equal(actionOf("wren").note, undefined, "the player's own unit reads the player's card");
    assert.match(actionOf("cleo").note, /^Cleo rolls Ward to use Page of the vigil litany: .*failed/);

    // The route rolls the Engine's dice for a bell's last charge: one that always breaks is gone.
    const brittleDoc = graveNoFights((doc) => {
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "kit")
        .entries.find((entry: { id: string }) => entry.id === "dawn-bell").item.charges.breaksOn = {
        die: 20,
        atMost: 20,
      };
    });
    const brittlePin = await pin("grave-classic-brittle", brittleDoc, parsedOrThrow(brittleDoc, "a brittle bell"));
    const brittle = await graveGame(brittlePin, 3);
    await chats.patchMetadata(brittle.chatId, { gameInventory: [{ ...kit[1]!, charges: 1 }] });
    const lastRing = await app.inject({
      method: "POST",
      url: "/game/inventory",
      payload: { chatId: brittle.chatId, ops: [{ op: "charge", name: "Dawn bell", count: 1 }] },
    });
    assert.equal(lastRing.statusCode, 200, lastRing.body);
    assert.deepEqual(lastRing.json().results, [{ ok: true, count: 1, broke: 1 }]);
    assert.deepEqual(lastRing.json().inventory, []);

    // The inventory route spends a charge, as the screen asks when a fight used the bell.
    const spent = await graveGame(gravePin, 3);
    const charged = await app.inject({
      method: "POST",
      url: "/game/inventory",
      payload: { chatId: spent.chatId, ops: [{ op: "charge", name: "Dawn bell", count: 1 }] },
    });
    assert.equal(charged.statusCode, 200, charged.body);
    assert.equal(
      (charged.json().inventory as GameInventoryStack[]).find((stack) => stack.id === "st-bell")?.charges,
      1,
    );

    // A fake bell (truly a grave spade, which a fight cannot use) holds charges as the bell it passes for:
    // the round's use comes out of it and does nothing, and spending its charge names it truly (1.79).
    {
      const fakeBell = await graveGame(gravePin, 3);
      // A real bell rung empty comes first: the charge is the fake's, the one with a charge left.
      const stacks = [
        { ...kit[1]!, id: "st-empty-bell", charges: 0 },
        { ...kit[1]!, id: "st-fake-bell", truly: "kit/grave-spade" },
      ];
      await chats.patchMetadata(fakeBell.chatId, { gameInventory: stacks });
      const rang = await app.inject({
        method: "POST",
        url: "/game/combat/round",
        payload: {
          chatId: fakeBell.chatId,
          round: 1,
          combatants,
          playerAction: { type: "item", itemId: "Dawn bell", targetId: "rat" },
        },
      });
      assert.equal(rang.statusCode, 200, rang.body);
      const bell = (rang.json().result.actions as Array<{ skillName?: string; note?: string }>).find(
        (action) => action.skillName === "Dawn bell",
      );
      assert.match(
        bell?.note ?? "",
        /really Grave spade, and it did nothing/,
        JSON.stringify(rang.json().result.actions),
      );
      // Two uses in one round: the fake's last charge goes first, then the real bell's.
      await chats.patchMetadata(fakeBell.chatId, {
        gameInventory: [
          { ...kit[1]!, id: "st-fake-last", truly: "kit/grave-spade", charges: 1 },
          { ...kit[1]!, id: "st-real-full", charges: 3 },
        ],
      });
      const twice = await app.inject({
        method: "POST",
        url: "/game/combat/round",
        payload: {
          chatId: fakeBell.chatId,
          round: 1,
          combatants: [...combatants, { ...combatants[0]!, id: "bram", name: "Bram" }],
          playerAction: { type: "item", itemId: "Dawn bell", targetId: "rat" },
          partyActions: { bram: { type: "item", itemId: "Dawn bell", targetId: "rat" } },
        },
      });
      assert.equal(twice.statusCode, 200, twice.body);
      const rung = (
        twice.json().result.actions as Array<{ attackerId: string; skillName?: string; note?: string }>
      ).filter((action) => action.skillName === "Dawn bell");
      assert.match(rung.find((action) => action.attackerId === "bram")?.note ?? "", /really Grave spade/);
      assert.equal(rung.find((action) => action.attackerId === "ada")?.note, undefined, JSON.stringify(rung));
      const charged = applyGameInventoryOps(
        stacks as never,
        [{ op: "charge", name: "Dawn bell", count: 1 }],
        undefined,
        (await loadGameInventoryItemBook(db, { chatId: fakeBell.chatId }, "player"))!,
      );
      assert.deepEqual(charged.results[0], { ok: true, count: 1, revealed: ["Grave spade"] });
      assert.deepEqual(charged.journal, [{ item: "Grave spade", action: "used", quantity: 1 }]);
    }

    // The combat director: the bell is offered by its uses and spends a charge; a failed page is spent
    // for nothing and the log says so. The page is worn, with a spare in the bag before it: only the
    // worn one counts, and it is the one spent.
    const directed = await graveGame(wornPin, 1);
    await chats.patchMetadata(directed.chatId, {
      gameInventory: [
        { id: "st-spare", name: "Page of the vigil litany", quantity: 1, item: "kit/litany-page" },
        { ...kit[0]!, quantity: 1, equipped: true },
        kit[1]!,
      ],
    });
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const started = await app.inject({
      method: "POST",
      url: "/combat/start",
      payload: {
        chatId: directed.chatId,
        anchor: directed.anchor,
        style: "classic",
        // Neither side can end the battle before Ada's turns come round: initiative is rolled again
        // every round, so the rat may act twice between them, and the bell may hit hard.
        party: [{ ...unit("ada", "Ada", "player"), hp: 300, maxHp: 300 }],
        enemies: [{ ...unit("rat", "Rat", "enemy"), hp: 300, maxHp: 300, attack: 0 }],
      },
    });
    assert.equal(started.statusCode, 200, started.body);
    type View = {
      id: string;
      instanceId: string;
      revision: number;
      stage: string;
      actorId?: string;
      window?: unknown;
      inventory: Array<{ name: string; quantity: number }>;
      log: Array<{ text: string }>;
    };
    let view = started.json().session as View;
    assert.deepEqual(
      view.inventory.map((line) => [line.name, line.quantity]),
      [
        ["Page of the vigil litany", 1],
        ["Dawn bell", 2],
      ],
    );
    let requests = 0;
    const command = async (body: Record<string, unknown>) => {
      const answer = await app.inject({
        method: "POST",
        url: "/combat/command",
        payload: {
          chatId: directed.chatId,
          anchor: directed.anchor,
          id: view.id,
          instanceId: view.instanceId,
          revision: view.revision,
          requestId: `r${++requests}`,
          command: body,
        },
      });
      assert.equal(answer.statusCode, 200, answer.body);
      view = answer.json().session as View;
    };
    const saved = async () =>
      JSON.parse((await chats.getById(directed.chatId))!.metadata as string).gameInventory as GameInventoryStack[];
    // Ada's turn comes round; each item command is hers to give.
    const onAdasTurn = async (action: Record<string, unknown>) => {
      for (let step = 0; step < 40; step++) {
        if (view.stage === "action" && view.actorId === "ada" && !view.window) {
          await command({ type: "classic", action });
          return;
        }
        await command({ type: "continue" });
      }
      assert.fail("Ada's turn never came");
    };
    await onAdasTurn({ type: "item", itemId: "Dawn bell", targetId: "rat" });
    assert.equal((await saved()).find((stack) => stack.id === "st-bell")?.charges, 1, "a charge spent");
    assert.equal(view.inventory.find((line) => line.name === "Dawn bell")?.quantity, 1, "one use left");
    await onAdasTurn({ type: "item", itemId: "Page of the vigil litany", targetId: "ada" });
    assert.deepEqual(
      (await saved()).filter((stack) => stack.item === "kit/litany-page").map((stack) => [stack.id, stack.quantity]),
      [["st-spare", 1]],
      "the worn page is spent, never the spare in the bag",
    );
    for (let step = 0; step < 20; step++) {
      if (view.log.some((entry) => /failed, and it is used up for nothing/.test(entry.text))) break;
      await command({ type: "continue" });
    }
    assert.ok(
      view.log.some((entry) =>
        /^Ada rolls Ward to use Page of the vigil litany: .*failed, and it is used up for nothing\.$/.test(entry.text),
      ),
      `the log says the check failed: ${view.log.map((entry) => entry.text).join(" | ")}`,
    );
  }

  // ── A fake in the Engine's own battles (Capability API 1.79) ──
  {
    // A waystone that passes for a poultice, held before two real ones: the battle lists one Poultice
    // line of three, and the use that comes out of the fake does nothing a battle can use, and says so.
    const fakeFirst: GameInventoryStack[] = [
      { id: "st-fake", name: "Poultice", quantity: 1, item: "outfitter/poultice", truly: "outfitter/waystone" },
      { id: "st-real", name: "Poultice", quantity: 2, item: "outfitter/poultice" },
    ];
    const fighter = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 20,
      maxHp: 100,
      mp: 0,
      maxMp: 0,
      // Nobody falls before the item is used: the rat does no harm.
      attack: side === "enemy" ? 0 : 10,
      defense: 5,
      speed: 5,
      level: 1,
    });
    const game = await newGame(emberPin);
    await chats.patchMetadata(game.chatId, { gameInventory: fakeFirst });
    const meta = JSON.parse((await chats.getById(game.chatId))!.metadata as string);
    assert.deepEqual(
      (await loadGameFightItems(db, meta, [])).lines
        .filter((line) => line.item === "outfitter/poultice")
        .map((line) => [line.name, line.quantity]),
      [["Poultice", 3]],
    );
    // The Classic round, sent as the screen sends it: every member's order among the party's, the
    // leader's last and again as its own command. The uses come out of the stacks in that order, once
    // each: Bram's out of the fake, the leader's out of a real one.
    const answer = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: {
        chatId: game.chatId,
        round: 1,
        combatants: [fighter("hero", "player"), fighter("bram", "player"), fighter("rat", "enemy")],
        controlledId: "hero",
        playerAction: { type: "item", itemId: "Poultice", targetId: "hero" },
        partyActions: {
          bram: { type: "item", itemId: "Poultice", targetId: "bram" },
          hero: { type: "item", itemId: "Poultice", targetId: "hero" },
        },
      },
    });
    assert.equal(answer.statusCode, 200, answer.body);
    const uses = (
      answer.json().result.actions as Array<{ attackerId: string; skillName?: string; note?: string; isHeal?: boolean }>
    ).filter((action) => action.skillName === "Poultice");
    assert.match(
      uses.find((action) => action.attackerId === "bram")?.note ?? "",
      /really Waystone, and it did nothing/,
    );
    assert.equal(uses.find((action) => action.attackerId === "hero")?.isHeal, true, JSON.stringify(uses));
    // Without the party's orders, the leader's command is the round's one use, out of the fake.
    const alone = await app.inject({
      method: "POST",
      url: "/game/combat/round",
      payload: {
        chatId: game.chatId,
        round: 1,
        combatants: [fighter("hero", "player"), fighter("rat", "enemy")],
        playerAction: { type: "item", itemId: "Poultice", targetId: "hero" },
      },
    });
    assert.equal(alone.statusCode, 200, alone.body);
    const aloneUses = (
      alone.json().result.actions as Array<{ attackerId: string; skillName?: string; note?: string }>
    ).filter((action) => action.attackerId === "hero" && action.skillName === "Poultice");
    assert.match(
      aloneUses.map((action) => action.note ?? "").join(" "),
      /really Waystone/,
      JSON.stringify(alone.json()),
    );

    // The combat director, Classic and Tactical: Ada's use comes out of the fake, the log says what it
    // was, and the fake is what was spent.
    for (const style of ["classic", "tactical"] as const) {
      const directed = await newGame(emberPin);
      await chats.patchMetadata(directed.chatId, { gameInventory: fakeFirst });
      const unit = (id: string, name: string, side: "player" | "enemy") => ({
        id,
        name,
        side,
        hp: 300,
        maxHp: 300,
        attack: side === "enemy" ? 0 : 8,
        defense: 6,
        speed: 6,
        level: 3,
        skills: [],
      });
      const started = await app.inject({
        method: "POST",
        url: "/combat/start",
        payload: {
          chatId: directed.chatId,
          anchor: directed.anchor,
          style,
          party: [unit("ada", "Ada", "player")],
          ...(style === "tactical"
            ? {
                battlefield: {
                  exposure: "exposed",
                  features: [{ terrain: "forest", placement: "center", shape: "patch" }],
                },
              }
            : {}),
          enemies: [unit("rat", "Rat", "enemy")],
        },
      });
      assert.equal(started.statusCode, 200, started.body);
      type View = {
        id: string;
        instanceId: string;
        revision: number;
        stage: string;
        actorId?: string;
        window?: unknown;
        inventory: Array<{ name: string; quantity: number }>;
        log: Array<{ text: string }>;
      };
      let view = started.json().session as View;
      assert.deepEqual(
        view.inventory.map((line) => [line.name, line.quantity]),
        [["Poultice", 3]],
      );
      let requests = 0;
      const command = async (body: Record<string, unknown>) => {
        const reply = await app.inject({
          method: "POST",
          url: "/combat/command",
          payload: {
            chatId: directed.chatId,
            anchor: directed.anchor,
            id: view.id,
            instanceId: view.instanceId,
            revision: view.revision,
            requestId: `fake-${style}-${++requests}`,
            command: body,
          },
        });
        assert.equal(reply.statusCode, 200, reply.body);
        view = reply.json().session as View;
      };
      for (let step = 0; step < 40; step++) {
        if (view.stage === "action" && view.actorId === "ada" && !view.window) break;
        // A Tactical party's phase waits for the player to pick who acts.
        await command(
          style === "tactical" && !view.actorId && !view.window
            ? { type: "begin", unitId: "ada" }
            : { type: "continue" },
        );
      }
      await command(
        style === "classic"
          ? { type: "classic", action: { type: "item", itemId: "Poultice", targetId: "ada" } }
          : { type: "tactical", action: { type: "item", unitId: "ada", itemName: "Poultice", targetId: "ada" } },
      );
      for (let step = 0; step < 20; step++) {
        if (view.log.some((entry) => /really Waystone/.test(entry.text))) break;
        await command({ type: "continue" });
      }
      assert.ok(
        view.log.some((entry) => /really Waystone, and it did nothing/.test(entry.text)),
        `${style}: the log says what it was: ${view.log.map((entry) => entry.text).join(" | ")}`,
      );
      const left = JSON.parse((await chats.getById(directed.chatId))!.metadata as string)
        .gameInventory as GameInventoryStack[];
      assert.deepEqual(
        left.filter((stack) => stack.item === "outfitter/poultice").map((stack) => [stack.id, stack.quantity]),
        [["st-real", 2]],
        "the fake is what was spent",
      );
    }
  }

  console.info("game ruleset classic items regressions passed.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
