/**
 * Charges over time (#6888, Capability API 1.61).
 *
 *   - An item's `charges.recharge` names the rests that bring its charges back, and how many; the
 *     sheet's Rest button (a server rest, the sheet and the bag written together) and the Game
 *     Master's `[sheet: op="rest"]` both refill what the resting character carries.
 *   - `charges.breaksOn` rolls a die when a use spends the last charge: at or under `atMost` the item
 *     breaks and is gone, in a fight and outside one, and the journal counts it lost.
 *   - Checked at import, gated at 1.61; the Game Master sees each charged stack's charges left.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  applySheetCommandTags,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  gameInventoryTotals,
  parseRulesetDefinition,
  readRulesetLive,
  rechargeRulesetItems,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetItemUseLine,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-item-charges-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const { gameInventoryRestRecharge } = await import("../../packages/server/src/services/game/game-item-use.service.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
const { rulesetCombatEventLine, rulesetCombatNames } =
  await import("../../packages/client/src/lib/ruleset-combat-log.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
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
  const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(gravewatchText, edit));
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const itemCatalogOf = (doc: Record<string, any>) =>
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "items");
  const itemEntry = (doc: Record<string, any>, id: string) =>
    itemCatalogOf(doc).entries.find((entry: { id: string }) => entry.id === id);
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const book = rulesetItemBook(gravewatch, entriesOf(gravewatch));
  const bell = book.itemOf("kit/dawn-bell")!.entry.item!;
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
    const found = events.find((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };

  // ── Import ──
  {
    assert.deepEqual(bell.charges, {
      max: 3,
      recharge: { rests: ["vigil"], amount: "max" },
      breaksOn: { die: 20, atMost: 1 },
    });
    const charges = (edit: (charges: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "dawn-bell").item.charges);
    refused(
      charges((c) => (c.recharge.rests = ["nap"])),
      /charges\.recharge\.rests\.0: Unknown rest "nap"/,
      "a rest",
    );
    refused(
      charges((c) => (c.recharge.amount = {})),
      /charges\.recharge\.amount: A recharge says how many/,
      "an amount",
    );
    refused(
      charges((c) => (c.recharge.rests = [])),
      /recharge\.rests/,
      "no rest",
    );
    refused(
      charges((c) => (c.breaksOn.atMost = 21)),
      /breaksOn\.atMost: A break is at most the die's own faces/,
      "faces",
    );
    refused(
      charges((c) => (c.breaksOn.die = 1)),
      /breaksOn\.die/,
      "a one-sided die",
    );
    refused(
      charges((c) => (c.recharge.when = "dawn")),
      /Unrecognized key/,
      "a key nobody reads",
    );
    parsedOrThrow(
      variant(
        gravewatchText,
        charges((c) => (c.recharge.amount = { dice: "1d2", flat: 1 })),
      ),
      "an amount back",
    );
  }

  // ── Install gate: 1.61 ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-item-charges",
      name: "Item charges",
      version: "0.1.0",
      description: "A packaged ruleset whose items regain charges.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /regain charges on a rest or break when emptied.*capabilityApi 1\.61/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    // Less the litany page's gate, which is 1.62's and has a lane of its own.
    const ungated = (doc: Record<string, any>) => delete itemEntry(doc, "litany-page").item.use.gate;
    assert.match(issue(60, variant(gravewatchText, ungated)) ?? "", gateIssue);
    assert.equal(issue(61, variant(gravewatchText, ungated)), null);
    const plain = (doc: Record<string, any>) => (itemEntry(doc, "dawn-bell").item.charges = { max: 3 });
    assert.equal(
      issue(
        60,
        variant(gravewatchText, (doc) => {
          plain(doc);
          ungated(doc);
        }),
      ),
      null,
      "the rest of the example stays 1.60",
    );
    const onlyBreaks = variant(gravewatchText, (doc) => {
      itemEntry(doc, "dawn-bell").item.charges = { max: 3, breaksOn: { die: 20, atMost: 1 } };
    });
    assert.match(issue(60, onlyBreaks) ?? "", gateIssue, "a break alone");
    const inFile = variant(gravewatchText, (doc) => {
      const catalog = itemCatalogOf(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/kit.json";
    });
    const paths = ["ruleset.json", "catalogs/kit.json"];
    const files = new Map<string, unknown>([
      ["catalogs/kit.json", { entries: itemCatalogOf(variant(gravewatchText, ungated)).entries }],
    ]);
    assert.match(issue(60, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(61, inFile, paths, files), null);
  }

  // ── Breaking in a fight ──
  const worn = (item: RulesetSheetItem["item"], charges?: number): RulesetSheetItem => ({
    item,
    quantity: 1,
    worn: true,
    name: "Dawn bell",
    ...(charges !== undefined ? { charges } : {}),
    stack: { id: "st-bell", ref: "kit/dawn-bell" },
  });
  const fight = (items: RulesetSheetItem[]) =>
    createRulesetEncounter({
      definition: gravewatch,
      seed: 5,
      roller: () => 4,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build: defaultRulesetSheetBuild(gravewatch), items },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 30, defense: 1, initiativeModifier: -20, actions: [] },
        },
      ],
    });
  const ring = (state: ReturnType<typeof fight>, face: number) =>
    applyRulesetCombatChoice(gravewatch, state, { actorId: "ada", optionId: "use:0", targetIds: ["foe"] }, () => face);
  {
    // The last charge rung, and a 1 on the d20: it cracks and is gone.
    const start = fight([worn(bell, 1)]);
    const cracked = ring(start, 1);
    assert.deepEqual(firstOf(cracked.events, "broke"), {
      type: "broke",
      actorId: "ada",
      optionId: "use:0",
      label: "Dawn bell",
      roll: 1,
    });
    const ada = rulesetCombatant(cracked.state, "ada")!;
    assert.deepEqual([ada.itemsUsed, ada.broken], [{ 0: 1 }, { 0: true }]);
    const names = rulesetCombatNames(
      gravewatch,
      { combatants: cracked.state.combatants } as never,
      ((key: string, params?: Record<string, unknown>) =>
        [key, ...Object.values(params ?? {}).map(String)].join("|")) as never,
    );
    assert.equal(
      rulesetCombatEventLine(firstOf(cracked.events, "broke"), names, ((
        key: string,
        params?: Record<string, unknown>,
      ) => [key, ...Object.values(params ?? {}).map(String)].join("|")) as never),
      "game.combat.ruleset.event.broke|Dawn bell|1",
    );
    // Written back: the bell is taken off its stack, and the journal says it was lost.
    const changes = rulesetFightItemChanges(start, cracked.state);
    assert.deepEqual(changes, [
      { stack: { id: "st-bell", ref: "kit/dawn-bell" }, name: "Dawn bell", taken: 1, charges: 0, broke: true },
    ]);
    const written = applyRulesetFightItemChanges(
      [
        {
          id: "st-bell",
          name: "Dawn bell",
          item: "kit/dawn-bell",
          quantity: 1,
          equipped: true,
          bound: true,
          charges: 1,
        },
      ],
      changes,
    )!;
    assert.deepEqual(written, { stacks: [], journal: [{ item: "Dawn bell", action: "lost", quantity: 1 }] });
    // Anything over the break holds; and a bell with charges to spare never rolls at all.
    const held = ring(start, 2);
    assert.equal(
      held.events.some((event) => event.type === "broke"),
      false,
    );
    assert.deepEqual(rulesetFightItemChanges(start, held.state)[0]?.taken, 0);
    let rolled = 0;
    const spare = applyRulesetCombatChoice(
      gravewatch,
      fight([worn(bell, 3)]),
      { actorId: "ada", optionId: "use:0", targetIds: ["foe"] },
      (sides) => {
        if (sides === 20) rolled += 1;
        return 1;
      },
    );
    assert.equal(
      spare.events.some((event) => event.type === "broke"),
      false,
    );
    assert.equal(rolled, 0, "only the last charge rolls");
    // An item that may not break never does.
    const sturdy = { ...bell, charges: { max: 3 } };
    assert.equal(
      ring(fight([worn(sturdy, 1)]), 1).events.some((event) => event.type === "broke"),
      false,
    );
  }

  // ── Breaking outside a fight ──
  {
    const stacks: GameInventoryStack[] = [
      { id: "st-bell", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true, bound: true, charges: 1 },
    ];
    const use = (face: number, charges?: number) =>
      useRulesetItemOutsideFight({
        definition: gravewatch,
        itemOf: book.itemOf,
        stacks: charges === undefined ? stacks : [{ ...stacks[0]!, charges }],
        stackId: "st-bell",
        user: { name: "Ada", build: defaultRulesetSheetBuild(gravewatch), live: {} },
        roll: () => face,
      });
    const cracked = use(1);
    assert.ok(cracked.ok);
    assert.equal(cracked.said.broke, 1);
    assert.deepEqual(cracked.stacks, []);
    assert.deepEqual(cracked.journal, [{ item: "Dawn bell", action: "lost", quantity: 1 }]);
    assert.match(rulesetItemUseLine(cracked.said), /\. Its last charge spent, it breaks \(a 1 on its die\)\.$/);
    const whole = use(7);
    assert.ok(whole.ok);
    assert.equal(whole.said.broke, undefined);
    assert.equal(whole.stacks[0]?.charges, 0);
    assert.match(rulesetItemUseLine(whole.said), /0 of 3 charges left\.$/);
    // A use that leaves a charge never rolls for a break, whatever the die would say.
    const spare = use(1, 2);
    assert.ok(spare.ok);
    assert.equal(spare.said.broke, undefined);
    assert.equal(spare.stacks[0]?.charges, 1);
  }

  // ── Recharging ──
  {
    const stacks: GameInventoryStack[] = [
      { id: "st-bell", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true, bound: true, charges: 1 },
      { id: "st-bram", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, holder: "Bram", charges: 0 },
      { id: "st-tonic", name: "Warming tonic", item: "kit/warming-tonic", quantity: 2 },
    ];
    const recharge = (rest: string, holder?: string, definition = gravewatch, roll = () => 1) =>
      rechargeRulesetItems({
        definition,
        itemOf: rulesetItemBook(definition, entriesOf(definition)).itemOf,
        stacks,
        holder,
        rest,
        roll,
      });
    const full = recharge("vigil");
    assert.deepEqual(full.recharged, [{ item: "Dawn bell", now: 3, max: 3 }]);
    assert.equal(full.stacks[0]!.charges, undefined, "full again reads as full");
    assert.equal(full.stacks[1]!.charges, 0, "another bag's bell is not the one resting");
    assert.deepEqual(recharge("breather").recharged, [], "a rest it does not name");
    assert.deepEqual(recharge("vigil", "Bram").recharged, [{ item: "Dawn bell", now: 3, max: 3 }]);
    // An amount back, never past the most.
    const trickle = parsedOrThrow(
      variant(
        gravewatchText,
        (doc) => (itemEntry(doc, "dawn-bell").item.charges.recharge.amount = { dice: "1d2", flat: 1 }),
      ),
      "a trickle back",
    );
    const some = recharge("vigil", "Bram", trickle, () => 2);
    assert.deepEqual(some.recharged, [{ item: "Dawn bell", now: 3, max: 3 }], "0 + 2 + 1");
    assert.deepEqual(recharge("vigil", undefined, trickle, () => 2).recharged, [{ item: "Dawn bell", now: 3, max: 3 }]);
    assert.deepEqual(recharge("vigil", undefined, trickle, () => 1).recharged, [{ item: "Dawn bell", now: 3, max: 3 }]);
    assert.deepEqual(recharge("vigil", "Bram", trickle, () => 1).recharged, [{ item: "Dawn bell", now: 2, max: 3 }]);
    assert.equal(recharge("vigil", "Bram", trickle, () => 1).stacks[1]!.charges, 2);
    // Nothing to give back, nothing changes.
    const fullStacks = stacks.map(({ charges: _charges, ...stack }) => stack);
    const none = rechargeRulesetItems({
      definition: gravewatch,
      itemOf: book.itemOf,
      stacks: fullStacks,
      holder: undefined,
      rest: "vigil",
      roll: () => 1,
    });
    assert.deepEqual([none.recharged, none.stacks], [[], fullStacks]);
  }

  // ── The Game Master's rest, per character, and the charges left it is shown ──
  {
    const cards = [
      { name: "Ada", build: defaultRulesetSheetBuild(gravewatch) },
      { name: "Bram", build: defaultRulesetSheetBuild(gravewatch) },
    ];
    const told = applySheetCommandTags(`They stand down. [sheet: who="party" op="rest" rest="vigil"]`, {
      definition: gravewatch,
      cards,
      playerName: null,
      live: {},
    });
    assert.deepEqual(told.rests, [
      { who: "Ada", rest: "vigil" },
      { who: "Bram", rest: "vigil" },
    ]);
    const stacks: GameInventoryStack[] = [
      { id: "st-bell", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, charges: 0 },
      { id: "st-bram", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, holder: "Bram", charges: 1 },
    ];
    const context = { definition: gravewatch, packageId: null, cards, playerName: null };
    const after = gameInventoryRestRecharge(context as never, book.itemOf, told.rests, 7)(stacks);
    assert.deepEqual(
      after.map((stack) => stack.charges),
      [undefined, undefined],
      "the first card is the player's, whose own bag rests; Bram's is his",
    );
    // What the Game Master is shown: each charged stack's charges left.
    const chargesOf = (stack: GameInventoryStack) => {
      const max = stack.item ? book.itemOf(stack.item)?.facts.use?.charges?.max : undefined;
      return max === undefined ? undefined : { now: Math.min(max, stack.charges ?? max), max };
    };
    const totals = gameInventoryTotals(
      [...stacks, { id: "st-tonic", name: "Warming tonic", item: "kit/warming-tonic", quantity: 1 }],
      chargesOf,
    );
    assert.deepEqual(totals[0]!.charges, [
      { now: 0, max: 3 },
      { now: 1, max: 3 },
    ]);
    assert.equal(totals[1]!.charges, undefined);
    const reminder = buildGmFormatReminder({
      hasSceneModel: true,
      ruleset: gravewatch,
      playerInventory: totals,
    } as never);
    assert.match(reminder, /Dawn bell ×2 \(0 of 3, 1 of 3 charges left\)/);
  }

  // ── The sheet's Rest button ──
  {
    const chats = createChatsStorage(db);
    const states = createGameStateStorage(db);
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/gravewatch-rest",
      version: 1,
      sourceKind: "local",
      definition: JSON.stringify({ ...JSON.parse(gravewatchText), id: "gravewatch-rest" }),
    });
    const game = async () => {
      const chat = await chats.create({ name: "Rest", mode: "game", characterIds: [] });
      const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The vigil ends." });
      await chats.patchMetadata(chat.id, {
        gameRuleset: { id: "local/gravewatch-rest", version: 1, packageId: null, options: {} },
        gameCharacterCards: [{ name: "Ada" }, { name: "Bram" }],
        gameInventory: [
          {
            id: "st-bell",
            name: "Dawn bell",
            item: "kit/dawn-bell",
            quantity: 1,
            equipped: true,
            bound: true,
            charges: 0,
          },
          { id: "st-bram", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, holder: "Bram", charges: 0 },
        ],
      });
      await states.create({
        chatId: chat.id,
        messageId: anchor.id,
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
      });
      await states.updateLatest(chat.id, { rulesetLive: { ada: { pools: { resolve: { value: 0 } } } } });
      return chat.id;
    };
    const chatId = await game();
    const rest = (character: string, restId: string) =>
      app.inject({ method: "POST", url: "/game/inventory/rest", payload: { chatId, character, rest: restId } });
    const answered = await rest("Ada", "vigil");
    assert.equal(answered.statusCode, 200, answered.body);
    const body = answered.json();
    assert.deepEqual(body.recharged, [{ item: "Dawn bell", now: 3, max: 3 }]);
    assert.equal(body.inventory.find((stack: GameInventoryStack) => stack.id === "st-bell").charges, undefined);
    assert.equal(body.inventory.find((stack: GameInventoryStack) => stack.id === "st-bram").charges, 0);
    assert.match(body.now, /Resolve/);
    // Written: the bag, and Ada's Resolve full again on the row the player sees.
    const saved = JSON.parse((await chats.getById(chatId))!.metadata as string).gameInventory as GameInventoryStack[];
    assert.equal(saved.find((stack) => stack.id === "st-bell")!.charges, undefined);
    const row = await states.getLatest(chatId);
    const live = row?.rulesetLive ? JSON.parse(row.rulesetLive as string) : {};
    const resolve = readRulesetLive(gravewatch, defaultRulesetSheetBuild(gravewatch), live.ada).pools.find(
      (pool) => pool.key === "resolve",
    )!;
    assert.equal(resolve.value, resolve.max);
    // Bram rests his own bag.
    const bram = await rest("Bram", "vigil");
    assert.equal(bram.statusCode, 200, bram.body);
    assert.equal(bram.json().inventory.find((stack: GameInventoryStack) => stack.id === "st-bram").charges, undefined);
    // A rest that leaves a pool low writes it low: the breather mends knocks, not Resolve.
    await states.updateLatest(chatId, { rulesetLive: { ada: { pools: { resolve: { value: 0 } } } } });
    const breather = await rest("Ada", "breather");
    assert.equal(breather.statusCode, 200, breather.body);
    assert.deepEqual(breather.json().recharged, []);
    const after = await states.getLatest(chatId);
    const kept = readRulesetLive(
      gravewatch,
      defaultRulesetSheetBuild(gravewatch),
      JSON.parse(after!.rulesetLive as string).ada,
    ).pools.find((pool) => pool.key === "resolve")!;
    assert.equal(kept.value, 0);
    // Refused, and nothing written.
    assert.equal((await rest("Cora", "vigil")).statusCode, 404);
    const unknown = await rest("Ada", "nap");
    assert.equal(unknown.statusCode, 409);
    assert.equal(unknown.json().reason, "unknown-rest");
    assert.equal(
      (await app.inject({ method: "POST", url: "/game/inventory/rest", payload: { chatId } })).statusCode,
      400,
    );
  }

  // ── What an item says ──
  {
    assert.deepEqual(rulesetItemFacts(gravewatch, bell).use?.charges, {
      cost: 1,
      max: 3,
      recharge: { rests: ["Stand down from the vigil"], amount: "max" },
      breaksOn: { die: 20, atMost: 1 },
    });
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, bell)),
      /spends 1 of 3 charges, regains all on Stand down from the vigil, breaks on a 1 on a d20 when emptied$/,
    );
  }

  console.log(
    "Ruleset item charges over time: import checks, the 1.61 gate, breaking in a fight and outside one, recharging per bag, the Game Master's party rest, the charges it is shown, the Rest route and item facts passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
