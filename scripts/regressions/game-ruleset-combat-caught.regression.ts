/**
 * A missile caught and thrown back (Capability API 1.416).
 *
 *   - Deflect Missiles: an arrow lessened to nothing opens a "caught" moment for the monk, whose throw
 *     back deals the arrow's own die and type with its own Dexterity, free of the reaction, for 1 ki.
 *   - Not caught: an arrow only lessened, or a monk with no hand free.
 *   - A pass lets it go.
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
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  RULESET_PASS_OPTION,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-caught-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 416);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const throwBack = (reaction: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    ({
      id: "throw-back",
      label: "Throw Back",
      rows: [
        { list: "features", values: { name: "Throw Back" } },
        { list: "counters", values: { name: "Ki", max: 3, recharge: "short" } },
      ],
      mechanics: {
        kind: "attack",
        attackRoll: true,
        targets: "enemy",
        range: 60,
        amount: { dice: "1d4" },
        amountAdd: { abilityMod: "dex" },
        free: true,
        usesOf: "Ki",
        throwsCaught: true,
        reaction: { on: "caught", freeSlot: "hand", ...reaction },
        ...extra,
      },
    }) as unknown as RulesetCatalogEntry;
  const features = [throwBack()];
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.sheet.derived.push({
      id: "deflect_missiles",
      label: "Deflect Missiles",
      op: "sum",
      of: [{ abilityMod: "dex" }, { field: "level" }],
    });
    doc.sheet.live.conditions.push({ id: "deflecting", label: "Deflecting" });
    doc.combat.conditions.push({
      condition: "deflecting",
      effects: [],
      modifiers: [
        { to: "damage-taken", blow: "ranged", dice: "1d10", add: { derived: "deflect_missiles" }, minus: true },
      ],
    });
    doc.catalogs.push({
      id: "monk",
      label: "Monk",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("monk", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const block = (): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "arrow",
        name: "Arrow",
        budget: "action",
        toHit: 20,
        damage: { count: 1, sides: 8, flat: 2, type: "piercing" },
        range: { normal: 80 },
      },
      {
        id: "heavy",
        name: "Heavy Arrow",
        budget: "action",
        toHit: 20,
        damage: { count: 0, sides: 0, flat: 30, type: "piercing" },
        range: { normal: 80 },
      },
    ],
  });
  const torch = (): RulesetSheetItem =>
    ({
      name: "Torch",
      quantity: 1,
      worn: true,
      item: { category: "gear", slots: { hand: 1 } } as unknown as RulesetCatalogItem,
    }) as RulesetSheetItem;
  // Every d20 a 15, every other die a 4.
  const faces = (sides: number) => (sides === 20 ? 15 : 4);
  const fight = (items: RulesetSheetItem[] = []): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: faces,
      combatants: [
        { id: "archer", name: "Archer", side: "enemy", block: block() },
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
            fields: { level: 3, ac: 12, speed: 40, hp_max: 40 },
            lists: { features: rows("features"), counters: rows("counters") },
          }),
          live: {},
          items,
          catalogs: { monk: features },
        },
      ],
    });
    state.order = ["archer", "monk"];
    state.turn = 0;
    rulesetCombatant(state, "monk")!.tracked.push({
      condition: "deflecting",
      rounds: null,
      endsAfter: "attacked",
    } as never);
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const ki = (state: RulesetEncounterState) => {
    const monk = who(state, "monk");
    return readRulesetLive(definition, monk.sheet!.build, monk.sheet!.live).pools.find((pool) =>
      pool.label.includes("Ki"),
    )?.value;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const shoot = (state: RulesetEncounterState, label = "Arrow") => {
    const option = rulesetCombatOptions(definition, state, "archer").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "archer", optionId: option.id, targetIds: ["monk"] },
      faces,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };

  // ── Caught: 4 + 2 less 4 + 3 + 3, and thrown back for 4 + 3 piercing, free, for 1 ki ──
  {
    const start = fight();
    const kiBefore = ki(start);
    assert.equal(kiBefore, 3);
    const shot = shoot(start);
    assert.deepEqual(
      of(shot.events, "damage").map((one) => one.dealt),
      [0],
      JSON.stringify(shot.events),
    );
    const window = shot.state.window;
    assert.ok(window, "the caught arrow is held for an answer");
    assert.equal(window.trigger.kind, "caught");
    assert.deepEqual(window.waiting, ["monk"]);
    assert.deepEqual(of(shot.events, "window").at(-1)?.moment, "caught");
    const option = rulesetWindowOptions(definition, shot.state, "monk").find((one) => one.label === "Throw Back");
    assert.ok(option, "the throw back is offered");
    const reactions = who(shot.state, "monk").budgets.reaction;
    const thrown = applyRulesetCombatChoice(
      definition,
      shot.state,
      { actorId: "monk", optionId: option.id, targetIds: [], window: window.id },
      faces,
    );
    assert.equal(of(thrown.events, "refused").length, 0, JSON.stringify(of(thrown.events, "refused")));
    const damage = of(thrown.events, "damage");
    assert.deepEqual(
      damage.map((one) => [one.targetId, one.dealt, one.damageType]),
      [["archer", 7, "piercing"]],
      JSON.stringify(thrown.events),
    );
    assert.equal(health(thrown.state, "archer"), 33);
    assert.equal(ki(thrown.state), 2, "1 ki");
    assert.equal(who(thrown.state, "monk").budgets.reaction, reactions, "free of the reaction");
    assert.equal(thrown.state.window, undefined);
  }

  // ── A pass lets it go ──
  {
    const shot = shoot(fight());
    const passed = applyRulesetCombatChoice(
      definition,
      shot.state,
      { actorId: "monk", optionId: RULESET_PASS_OPTION, targetIds: [], window: shot.state.window!.id },
      faces,
    );
    assert.equal(passed.state.window, undefined);
    assert.equal(health(passed.state, "archer"), 40);
    assert.equal(ki(passed.state), 3);
  }

  // ── Not caught: only lessened, or no hand free ──
  {
    const heavy = shoot(fight(), "Heavy Arrow");
    assert.deepEqual(
      of(heavy.events, "damage").map((one) => one.dealt),
      [20],
    );
    assert.notEqual(heavy.state.window?.trigger.kind, "caught");
    const full = shoot(fight([torch(), torch()]));
    assert.deepEqual(
      of(full.events, "damage").map((one) => one.dealt),
      [0],
    );
    assert.equal(full.state.window, undefined, "no hand free to catch it");
    const one = shoot(fight([torch()]));
    assert.equal(one.state.window?.trigger.kind, "caught", "one hand free is enough");
    const dropped = fight([torch(), torch()]);
    who(dropped, "monk").dropped = [{ key: "item:0", label: "Torch" }];
    assert.equal(shoot(dropped).state.window?.trigger.kind, "caught", "a torch let fall takes no hand");
  }

  // ── Refusals ──
  {
    const withThrow = (entry: RulesetCatalogEntry) =>
      document((doc) => {
        doc.catalogs.at(-1).entries = [entry];
      });
    refused(withThrow(throwBack({ on: "hit" })), /"throwsCaught" is an attack that rolls to hit with an amount/);
    refused(
      withThrow(throwBack({}, { attackRoll: false })),
      /"throwsCaught" is an attack that rolls to hit with an amount/,
    );
    refused(withThrow(throwBack({ freeSlot: "tail" })), /Unknown item slot "tail"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose reaction answers a caught missile (on caught, throwsCaught) or needs a free slot (freeSlot) requires schemaVersion 2 and capabilityApi 1.416 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(415) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(416) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(415) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Caught: an arrow lessened to nothing opens a caught moment, thrown back with its own die and type for 1 ki, free of the reaction; not when only lessened or with no hand free; gated at 1.416.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
