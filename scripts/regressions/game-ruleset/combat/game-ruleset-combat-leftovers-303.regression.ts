/**
 * Left over from 1.303 to 1.305 (Capability API 1.308).
 *
 *   - A reaction is acting: a condition that `acts` ends comes off on any reaction its holder takes,
 *     Cutting Words included (One with Shadows' "or a reaction").
 *   - Once a creature until a rest tells two creatures of one name apart: the chains on one imp leave
 *     the other imp, and a later fight's imp is barred only when that name was one creature's.
 *   - An item's use may carry `targetsScale` and `targetsRepeat`: a scroll of eldritch blast read by
 *     its reader's level.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-leftovers-303-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 303);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const cutting = {
    id: "cutting-words",
    label: "Cutting Words",
    rows: [
      { list: "features", values: { name: "Cutting Words" } },
      { list: "counters", values: { name: "Bardic Inspiration", max: 3, recharge: "long" } },
    ],
    mechanics: {
      kind: "debuff",
      free: true,
      usesOf: "Bardic Inspiration",
      reaction: { on: "hit", for: "ally", within: 60 },
      lowersRoll: { die: { from: { field: "level" }, table: [[1, 6]] } },
    },
  } as unknown as RulesetCatalogEntry;
  const chains = {
    id: "chains",
    label: "Chains",
    rows: [{ list: "spells", values: { name: "Chains", level: 0, prepared: true } }],
    mechanics: {
      kind: "attack",
      range: 60,
      autoHit: true,
      amount: { flat: 1 },
      damageType: "force",
      oncePerTarget: { until: "long" },
    },
  } as unknown as RulesetCatalogEntry;
  const scrollUse = (extra: Record<string, unknown>) => ({
    kind: "attack",
    budget: "action",
    range: 120,
    attackRoll: true,
    amount: { dice: "1d10" },
    damageType: "force",
    ...extra,
  });
  const beams = {
    targetsScale: {
      from: { field: "level" },
      table: [
        [1, 0],
        [5, 1],
        [11, 2],
      ],
    },
    targetsRepeat: true,
  };
  const scroll = (use: Record<string, unknown>) => ({
    id: "scroll",
    label: "Scroll of Eldritch Blast",
    item: { category: "gear", use },
  });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "shadowed", label: "Shadowed" }, { id: "brave", label: "Brave" });
    doc.combat.conditions.push({ condition: "shadowed", effects: [] }, { condition: "brave", effects: [] });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({ id: "lore", label: "Lore", feeds: ["features", "counters"], entries: [cutting] });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [chains] });
    doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [scroll(scrollUse(beams))] });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const choose = (state: RulesetEncounterState, actorId: string, optionId: string, targetIds: string[] = []) => {
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId, targetIds }, (sides) =>
      sides === 20 ? 12 : 3,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatant(state, id)!.tracked.some((one) => one.condition === condition);

  // ── A reaction is acting ──
  {
    const sheet = (lists: Record<string, unknown[]> = {}) =>
      rulesetSheetBuildSchema.parse({
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
        fields: { level: 3, ac: 15, speed: 30, hp_max: 60 },
        lists,
      });
    const rows = (list: string) =>
      rowsFromCatalogEntry("lore", cutting).flatMap((one) => (one.list === list ? [one.row] : []));
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "bard",
          name: "Bard",
          side: "party",
          build: sheet({ features: rows("features"), counters: rows("counters") }),
          live: {},
          catalogs: { lore: [cutting] },
        },
        { id: "ally", name: "Ally", side: "party", build: sheet(), live: {} },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 100,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 5, reach: 5, damage: { flat: 4 } }],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["foe", "bard", "ally"];
    state.turn = 0;
    const bard = rulesetCombatant(state, "bard")!;
    bard.tracked.push(
      { condition: "shadowed", rounds: 100, endsWhenHolder: { acts: true } },
      { condition: "brave", rounds: 100, endsWhenHolder: { attacks: true } },
    );
    const bite = rulesetCombatOptions(definition, state, "foe").find((one) => one.label === "Bite")!;
    const held = choose(state, "foe", bite.id, ["ally"]);
    assert.equal(held.state.window?.trigger.kind, "hit");
    const cut = rulesetWindowOptions(definition, held.state, "bard").find((one) => one.label === "Cutting Words");
    assert.ok(cut, "Cutting Words is offered");
    const answered = choose(held.state, "bard", cut.id);
    assert.equal(of(answered.events, "lowered").length, 1);
    assert.equal(holds(answered.state, "bard", "shadowed"), false, "a reaction ends what acting ends");
    assert.equal(holds(answered.state, "bard", "brave"), true, "but is no attack");
  }

  // ── Two creatures of one name ──
  {
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
      fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "cha" },
      lists: { spells: rowsFromCatalogEntry("spells", chains).map((row) => row.row) },
    });
    const foe = (id: string, name: string) => ({
      id,
      name,
      side: "enemy" as const,
      block: {
        health: 500,
        defense: 5,
        initiativeModifier: 0,
        speed: 30,
        actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
      },
    });
    const fight = (live: unknown, foes: ReturnType<typeof foe>[]): RulesetEncounterState => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 1,
        combatants: [{ id: "lock", name: "Lock", side: "party", build, live, catalogs: { spells: [chains] } }, ...foes],
      });
      state.order = ["lock", ...foes.map((one) => one.id)];
      state.turn = 0;
      return state;
    };
    const option = (state: RulesetEncounterState) => {
      state.turn = 0;
      const lock = rulesetCombatant(state, "lock")!;
      for (const key of Object.keys(lock.budgets)) lock.budgets[key] = 9;
      const found = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === "Chains");
      assert.ok(found, "no Chains");
      return found;
    };
    const targets = (state: RulesetEncounterState) => rulesetOptionTargets(definition, state, "lock", option(state));
    const twins = fight({}, [foe("a", "Imp"), foe("b", "Imp"), foe("q", "Quasit")]);
    assert.deepEqual(targets(twins), ["a", "b", "q"]);
    const first = choose(twins, "lock", option(twins).id, ["a"]);
    assert.deepEqual(targets(first.state), ["b", "q"], "the other imp is still offered");
    const second = choose(first.state, "lock", option(first.state).id, ["q"]);
    const live = rulesetCombatant(second.state, "lock")!.sheet!.live;
    assert.deepEqual(live.usedOn, { "long|spells/chains": ["imp#a", "quasit#q", "quasit"] });
    // A later fight knows a creature by a name only it bore.
    assert.deepEqual(targets(fight(live, [foe("x", "Imp"), foe("y", "Quasit")])), ["x"]);
    // Two of that name later: which one it was is not known, so neither is barred.
    assert.deepEqual(targets(fight(live, [foe("y", "Quasit"), foe("z", "Quasit")])), ["y", "z"]);
    // And by its id while two bear its name.
    assert.deepEqual(targets(fight(live, [foe("a", "Imp"), foe("c", "Imp")])), ["c"]);
  }

  // ── Beams off a scroll ──
  {
    const reader = (level: number) =>
      rulesetSheetBuildSchema.parse({
        abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
        fields: { level, ac: 12, speed: 30, hp_max: 60 },
      });
    const item = definition.catalogs!.find((one) => one.id === "gear")!.entries![0]!.item as RulesetCatalogItem;
    const fight = (level: number) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 15,
        combatants: [
          {
            id: "lock",
            name: "Lock",
            side: "party",
            build: reader(level),
            live: {},
            items: [{ item, quantity: 1, worn: false, name: "Scroll of Eldritch Blast" }],
          },
          foe("a"),
          foe("b"),
        ],
      });
      state.order = ["lock", "a", "b"];
      state.turn = 0;
      return state;
    };
    function foe(id: string) {
      return {
        id,
        name: id.toUpperCase(),
        side: "enemy" as const,
        block: { health: 500, defense: 5, initiativeModifier: 0, speed: 30, actions: [] },
      };
    }
    const use = (state: RulesetEncounterState) => {
      state.turn = 0;
      const lock = rulesetCombatant(state, "lock")!;
      for (const key of Object.keys(lock.budgets)) lock.budgets[key] = 9;
      return rulesetCombatOptions(definition, state, "lock").find((one) => one.label.includes("Scroll"));
    };
    assert.equal(use(fight(1))!.targets.count, 1, "one beam at 1st level");
    assert.equal(use(fight(11))!.targets.count, 3, "three at 11th");
    assert.equal(use(fight(11))!.targets.repeat, true);
    const state = fight(5);
    const shot = choose(state, "lock", use(state)!.id, ["a", "a"]);
    assert.equal(
      of(shot.events, "attack").filter((one) => one.targetId === "a").length,
      2,
      "two beams at the same foe, each its own roll",
    );
  }

  // ── Refusals ──
  const withScroll = (use: Record<string, unknown>) =>
    fiveE((doc) => {
      doc.catalogs.find((one: { id: string }) => one.id === "gear").entries = [scroll(use)];
    });
  refusedDoc(withScroll(scrollUse({ targetsRepeat: true, area: { shape: "burst", size: 10 } })), /targetsRepeat/);
  refusedDoc(withScroll(scrollUse({ targetsRepeat: true, targets: "self" })), /targetsRepeat/);
  refusedDoc(withScroll(scrollUse({ targetsScale: { from: { field: "nope" }, table: [[1, 1]] } })), /targetsScale/);

  // ── The gate ──
  {
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
    const gate =
      "A ruleset with an item use whose targets grow with the sheet, or that takes the same target more than once, requires schemaVersion 2 and capabilityApi 1.308 or newer";
    const docWith = (entry: Record<string, unknown>) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [entry] });
      return doc;
    };
    const more = {
      id: "wand",
      label: "Wand",
      item: {
        category: "gear",
        use: scrollUse({}),
        moreUses: [{ label: "Darts", use: scrollUse({ targetsRepeat: true }) }],
      },
    };
    for (const doc of [docWith(scroll(scrollUse(beams))), docWith(more)]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(307) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(308) as never, doc), gate);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(307) as never, docWith(scroll(scrollUse({})))), gate);
  }

  console.log(
    "Leftovers 1.308: a reaction ends what acting ends; two imps told apart by Chains; a scroll's beams grow with its reader; refusals; gated at 1.308.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
