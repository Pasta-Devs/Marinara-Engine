/**
 * Layered walls (Capability API 1.490), as 5e's Prismatic Wall has them.
 *
 *   - Whoever moves into it meets each standing layer in turn, each with its own damage type, its
 *     own conditions and its own save; whom it `spares` crosses it unharmed.
 *   - Its first standing layer, and only that one, is destroyed as its `endedBy` says: a blow struck
 *     at the wall or an area reaching it dealing enough of a type, a wind, a named entry reaching it
 *     or aimed at it as Dispel Magic is. The wall ends with its last layer.
 *   - Its flash: whoever sees it within reach saves or is blinded, as it appears, as they move near
 *     and as their turn starts there.
 *   - Passwall (1.491): an entry with `endsLayers`, aimed at the wall, offered only while one stands.
 *   - A scroll of Passwall (1.494): an item's use with `endsLayers`, read as the spell it names.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_MOVE_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-layered-walls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 490);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // Prismatic Wall, four of its layers: red fire (ended by 25 cold), orange acid (by a wind), indigo
  // restraining on a Constitution save (by Daylight), violet blinding on a Wisdom save (by Dispel).
  const layers = {
    spares: "allies",
    rows: [
      { id: "red", label: "Red", damageType: "fire", endedBy: { damage: { types: ["cold"], atLeast: 25 } } },
      { id: "orange", label: "Orange", damageType: "acid", endedBy: { wind: true } },
      {
        id: "indigo",
        label: "Indigo",
        applies: ["restrained"],
        save: "con_save",
        endedBy: { entries: ["spells/daylight", "spells/passwall"] },
      },
      {
        id: "violet",
        label: "Violet",
        applies: ["blinded"],
        save: "wis_save",
        endedBy: { entries: ["spells/dispel"] },
      },
    ],
    flash: {
      within: 20,
      save: "con_save",
      applies: [{ condition: "blinded", duration: { rounds: 10 } }],
      triggers: ["appears", "enter", "turn-start"],
    },
  };
  const prismMechanics = {
    kind: "attack",
    autoHit: true,
    area: { shape: "wall", size: 20 },
    range: 60,
    amount: { flat: 10 },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
    applies: [
      { condition: "restrained", duration: { rounds: 10 } },
      { condition: "blinded", duration: { rounds: 10 } },
    ],
    zone: { rounds: 100, triggers: ["enter"], atCast: false, blocks: ["sight"], layers },
  };
  const prism = spell("prism", prismMechanics);
  const frost = spell("frost", {
    kind: "attack",
    autoHit: true,
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 30 },
    damageType: "cold",
    save: { save: "dex_save", onSuccess: "half" },
  });
  const gust = spell("gust", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], disperses: true },
  });
  const daylight = spell("daylight", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 5, dim: 5 } },
  });
  const dispel = spell("dispel", {
    kind: "utility",
    targets: "any",
    range: 120,
    endsSpells: { catalogs: ["spells"], upTo: "paid", zones: true },
  });
  // Passwall, which does nothing else in a fight (1.491).
  const passwall = spell("passwall", { kind: "utility", range: 30, endsLayers: true });
  const spells = [prism, frost, gust, daylight, dispel, passwall];
  // A scroll of it (1.494), read as the spell at a layered wall.
  const scrollUse = (extra: Record<string, unknown> = {}) => ({
    kind: "utility",
    budget: "action",
    range: 30,
    consumes: true,
    endsLayers: true,
    endsLayersAs: "spells/passwall",
    ...extra,
  });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "passwall-scroll", label: "Scroll of Passwall", item: { category: "gear", use: scrollUse() } }],
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const scrollItem = () =>
    structuredClone(definition.catalogs!.find((one) => one.id === "gear")!.entries![0]!.item) as RulesetCatalogItem;
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  // A brute with a frost blow that ends the red layer and a chill that does not.
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "frost-blow", name: "Frost Blow", budget: "action", toHit: 4, damage: { flat: 30, type: "cold" } },
        { id: "chill", name: "Chill", budget: "action", toHit: 4, damage: { flat: 10, type: "cold" } },
      ],
    }) as unknown as RulesetStatBlock;
  let d20 = 10;
  const roll = (sides: number) => (sides === 20 ? d20 : 1);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: caster(),
          live: {},
          catalogs: { spells },
          items: [{ item: scrollItem(), quantity: 1, worn: false, name: "Scroll of Passwall" }],
        },
        { id: "a", name: "A", side: "enemy", block: block() },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 20, height: 15, tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 7 }, druid: { x: 2, y: 9 }, a: { x: 8, y: 7 }, b: { x: 14, y: 7 } },
      },
    });
    state.order = ["mage", "druid", "a", "b"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const act = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    extra: Record<string, unknown>,
  ): RulesetCombatStep => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [], ...extra },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const walk = (state: RulesetEncounterState, actorId: string, to: RulesetCombatCell) => {
    state.turn = state.order.indexOf(actorId);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const zoneEvents = (events: RulesetCombatEvent[]) =>
    events.flatMap((one) => (one.type === "zone" ? [[one.outcome, one.layer ?? "", one.targetId ?? ""]] : []));
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    who(state, id).tracked.some((one) => one.condition === condition);
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const wall = (state: RulesetEncounterState) => who(state, "mage").zones?.find((one) => one.label === "Prism");
  // The wall across the mage's line at x 5, rows 6 to 9.
  const walled = (): RulesetEncounterState => {
    d20 = 10;
    const state = act(fight(), "mage", "Prism", { at: { x: 5, y: 7 } }).state;
    for (const one of state.combatants) one.tracked = one.tracked.filter((entry) => entry.condition !== "blinded");
    return state;
  };
  const gone = (state: RulesetEncounterState, count: number) => {
    wall(state)!.layersGone = count;
    return state;
  };

  // ── It appears: whoever sees it near it is flashed, those it spares and those far off are not ──
  {
    d20 = 10;
    const step = act(fight(), "mage", "Prism", { at: { x: 5, y: 7 } });
    assert.ok(wall(step.state), "the wall stands");
    assert.equal(holds(step.state, "a", "blinded"), true, "A, 15 feet off, fails and is blinded");
    assert.equal(holds(step.state, "b", "blinded"), false, "B is too far off");
    assert.equal(holds(step.state, "mage", "blinded"), false, "its caster is spared");
    assert.equal(holds(step.state, "druid", "blinded"), false, "and their side");
    d20 = 20;
    const made = act(fight(), "mage", "Prism", { at: { x: 5, y: 7 } });
    assert.equal(holds(made.state, "a", "blinded"), false, "a made save");
  }

  // ── Moving near it, or starting a turn there ──
  {
    const near = walk(walled(), "b", { x: 9, y: 7 });
    assert.equal(holds(near.state, "b", "blinded"), true, "B walks within 20 feet and is flashed");
    const state = walled();
    state.turn = state.order.indexOf("druid");
    const turned = advanceRulesetTurn(definition, state, roll).state;
    assert.equal(turned.order[turned.turn], "a");
    assert.equal(holds(turned, "a", "blinded"), true, "A starts its turn near it and is flashed");
  }

  // ── Crossing it: each layer in turn, each saved against on its own ──
  {
    const step = walk(walled(), "a", { x: 5, y: 7 });
    assert.deepEqual(
      zoneEvents(step.events).filter(([outcome]) => outcome === "struck"),
      [
        ["struck", "Red", "a"],
        ["struck", "Orange", "a"],
        ["struck", "Indigo", "a"],
        ["struck", "Violet", "a"],
      ],
    );
    const damage = step.events.flatMap((one) =>
      one.type === "damage" && one.targetId === "a" ? [one.damageType] : [],
    );
    assert.deepEqual(damage, ["fire", "acid"], "red's fire and orange's acid, and nothing from the rest");
    assert.equal(hp(step.state, "a"), 80);
    assert.equal(holds(step.state, "a", "restrained"), true, "indigo restrains");
    assert.equal(holds(step.state, "a", "blinded"), true, "violet blinds");
    const saves = step.events.flatMap((one) => (one.type === "save" && one.actorId === "a" ? [one.save] : []));
    assert.deepEqual(saves, ["dex_save", "dex_save", "con_save", "wis_save"], "each layer its own save");
    // Saved throughout: half of each, and nothing put on.
    d20 = 20;
    const state = walled();
    d20 = 20;
    const saved = walk(state, "a", { x: 5, y: 7 });
    assert.equal(hp(saved.state, "a"), 90);
    assert.equal(holds(saved.state, "a", "restrained"), false);
    // Its caster walks through unharmed.
    d20 = 10;
    const own = walk(walled(), "mage", { x: 5, y: 7 });
    assert.deepEqual(zoneEvents(own.events), []);
    assert.equal(hp(own.state, "mage"), hp(fight(), "mage"));
  }

  // ── A blow at the wall: 30 cold ends the red layer, 10 does not; then only the rest are crossed ──
  {
    d20 = 15;
    // A steps up beside it first.
    const beside = (state: RulesetEncounterState) => {
      who(state, "a").x = 6;
      state.turn = state.order.indexOf("a");
      return state;
    };
    const state = beside(walled());
    const option = rulesetCombatOptions(definition, state, "a").find((one) => one.label === "Frost Blow");
    assert.ok(
      option?.walls?.some((cell) => cell.x === 5 && cell.y === 7),
      "the wall may be struck at",
    );
    const weak = act(beside(walled()), "a", "Chill", { wall: { x: 5, y: 7 } });
    assert.deepEqual(zoneEvents(weak.events), [["layer-held", "Red", "a"]]);
    assert.equal(wall(weak.state)!.layersGone, undefined);
    const strong = act(state, "a", "Frost Blow", { wall: { x: 5, y: 7 } });
    assert.deepEqual(zoneEvents(strong.events), [["layer-gone", "Red", "a"]]);
    assert.equal(wall(strong.state)!.layersGone, 1);
    d20 = 10;
    const crossed = walk(strong.state, "a", { x: 5, y: 7 });
    assert.deepEqual(
      zoneEvents(crossed.events).flatMap(([outcome, layer]) => (outcome === "struck" ? [layer] : [])),
      ["Orange", "Indigo", "Violet"],
    );
    assert.equal(hp(crossed.state, "a"), 90, "acid only");
  }

  // ── An area reaching it: 30 cold ends the red layer ──
  {
    const step = act(walled(), "mage", "Frost", { at: { x: 4, y: 7 } });
    assert.ok(zoneEvents(step.events).some(([outcome, layer]) => outcome === "layer-gone" && layer === "Red"));
    assert.equal(wall(step.state)!.layersGone, 1);
  }

  // ── A wind ends the orange layer, once the red is gone; not before ──
  {
    const early = act(walled(), "druid", "Gust", { at: { x: 5, y: 7 } });
    assert.equal(wall(early.state)!.layersGone, undefined, "the red layer stands first");
    const blown = act(gone(walled(), 1), "druid", "Gust", { at: { x: 5, y: 7 } });
    assert.deepEqual(
      zoneEvents(blown.events).filter(([outcome]) => outcome.startsWith("layer")),
      [["layer-gone", "Orange", ""]],
    );
    assert.equal(wall(blown.state)!.layersGone, 2);
  }

  // ── Daylight reaching it ends the indigo layer ──
  {
    const lit = act(gone(walled(), 2), "druid", "Daylight", { at: { x: 4, y: 8 } });
    assert.ok(zoneEvents(lit.events).some(([outcome, layer]) => outcome === "layer-gone" && layer === "Indigo"));
    assert.equal(wall(lit.state)!.layersGone, 3);
    const early = act(walled(), "druid", "Daylight", { at: { x: 4, y: 8 } });
    assert.equal(wall(early.state)!.layersGone, undefined);
  }

  // ── Dispel Magic aimed at it: only the violet layer, and the wall ends with it ──
  {
    const aim = (state: RulesetEncounterState) => {
      state.turn = state.order.indexOf("druid");
      const offered = rulesetCombatOptions(definition, state, "druid").find((one) => one.label === "Dispel")?.dispels;
      assert.ok(
        offered?.some((one) => one.label === "Prism"),
        JSON.stringify(offered),
      );
      return act(state, "druid", "Dispel", { dispel: { casterId: "mage", actionId: wall(state)!.actionId } });
    };
    const early = aim(walled());
    assert.deepEqual(zoneEvents(early.events), [["layer-held", "Red", "druid"]]);
    assert.ok(wall(early.state), "the wall stands");
    const last = aim(gone(walled(), 3));
    assert.deepEqual(zoneEvents(last.events), [
      ["layer-gone", "Violet", "druid"],
      ["ended", "", ""],
    ]);
    assert.equal(wall(last.state), undefined, "the wall is gone with its last layer");
  }

  // ── Passwall (1.491): offered only while a wall it may break stands, and only on its own layer ──
  {
    const bare = fight();
    bare.turn = bare.order.indexOf("druid");
    assert.equal(
      rulesetCombatOptions(definition, bare, "druid").some((one) => one.label === "Passwall"),
      false,
      "nothing to break",
    );
    const aim = (state: RulesetEncounterState) =>
      act(state, "druid", "Passwall", { dispel: { casterId: "mage", actionId: wall(state)!.actionId } });
    const early = aim(walled());
    assert.deepEqual(zoneEvents(early.events), [["layer-held", "Red", "druid"]]);
    const opened = aim(gone(walled(), 2));
    assert.deepEqual(zoneEvents(opened.events), [["layer-gone", "Indigo", "druid"]]);
    assert.equal(wall(opened.state)!.layersGone, 3);
    // Out of its reach, it is not offered.
    const far = walled();
    who(far, "druid").x = 14;
    who(far, "druid").y = 1;
    far.turn = far.order.indexOf("druid");
    assert.equal(
      rulesetCombatOptions(definition, far, "druid").some((one) => one.label === "Passwall"),
      false,
      "too far",
    );
  }

  // ── A scroll of Passwall (1.494): read as the spell, used up ──
  {
    const scrolled = walled();
    scrolled.turn = scrolled.order.indexOf("druid");
    const label = rulesetCombatOptions(definition, scrolled, "druid").find((one) =>
      one.label.startsWith("Scroll"),
    )?.label;
    assert.equal(
      label,
      "Scroll of Passwall",
      rulesetCombatOptions(definition, scrolled, "druid")
        .map((one) => one.label)
        .join(", "),
    );
    const opened = act(gone(scrolled, 2), "druid", label, {
      dispel: { casterId: "mage", actionId: wall(scrolled)!.actionId },
    });
    assert.deepEqual(zoneEvents(opened.events), [["layer-gone", "Indigo", "druid"]]);
    // With nothing to break, it is not offered.
    const bare = fight();
    bare.turn = bare.order.indexOf("druid");
    assert.equal(
      rulesetCombatOptions(definition, bare, "druid").some((one) => one.label === "Scroll of Passwall"),
      false,
    );
  }

  // ── Refusals ──
  const withScroll = (use: Record<string, unknown>) =>
    fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].item.use = use;
    });
  refusedDoc(withScroll(scrollUse({ endsLayersAs: undefined })), /names endsLayersAs/);
  refusedDoc(withScroll(scrollUse({ endsLayers: undefined })), /goes with "endsLayers"/);
  refusedDoc(withScroll(scrollUse({ endsLayersAs: "tomes/passwall" })), /Unknown catalog "tomes"/);
  const withPrism = (change: (mechanics: Record<string, any>) => void) =>
    fiveE((doc) => {
      const entry = doc.catalogs.at(-2).entries.find((one: { id: string }) => one.id === "prism");
      change(entry.mechanics);
    });
  refusedDoc(
    withPrism((mechanics) => delete mechanics.area),
    /Layers are a wall or a globe crossed/,
  );
  refusedDoc(
    withPrism((mechanics) => delete mechanics.save),
    /layers go with "save"/,
  );
  refusedDoc(
    withPrism((mechanics) => (mechanics.zone.layers.rows[2].applies = ["charmed"])),
    /A layer puts on only what the entry "applies": "charmed"/,
  );
  refusedDoc(
    withPrism((mechanics) => (mechanics.zone.layers.rows[2].save = "luck_save")),
    /Unknown save "luck_save"/,
  );
  refusedDoc(
    withPrism((mechanics) => (mechanics.zone.layers.flash.applies[0].condition = "dazzled")),
    /Unknown condition "dazzled"/,
  );
  refusedDoc(
    withPrism((mechanics) => (mechanics.zone.layers.rows[0].endedBy = {})),
    /"endedBy" says/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones are layers crossed one at a time (zone layers) requires schemaVersion 2 and capabilityApi 1.490 or newer";
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
    const plain = fiveE((doc) => {
      doc.catalogs.at(-2).entries = doc.catalogs.at(-2).entries.filter((one: { id: string }) => one.id !== "passwall");
      doc.catalogs.pop();
      delete doc.items;
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(489) as never, plain), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(490) as never, plain), gate);
    const passGate =
      "A ruleset whose entries break a layered wall's layer by being aimed at it (endsLayers) requires schemaVersion 2 and capabilityApi 1.491 or newer";
    const spellOnly = fiveE((doc) => {
      doc.catalogs.pop();
      delete doc.items;
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(490) as never, spellOnly), passGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(491) as never, spellOnly), passGate);
    const scrollGate =
      "A ruleset whose items' uses break a layered wall's layer as an entry they name (endsLayersAs) requires schemaVersion 2 and capabilityApi 1.494 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(493) as never, fiveE()), scrollGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(494) as never, fiveE()), scrollGate);
  }

  console.log(
    "Layered walls: a Prismatic Wall crossed a layer at a time, each with its own save, its caster's side spared; its layers destroyed in order by cold, wind, Daylight and Dispel Magic, Passwall and its scroll; its flash as it appears, as foes come near and as their turns start; gated at 1.490, 1.491 and 1.494.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
