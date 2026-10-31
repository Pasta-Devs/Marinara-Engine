/**
 * Stepping in front of an attack, and defense against one kind of attack (Capability API 1.509).
 *
 *   - `takesAim`: taken as a ranged attack is aimed at an ally within 5 feet, its holder becomes the
 *     target instead. Not for a melee attack, nor an ally farther off.
 *   - A defense modifier with `blow`: +2 against ranged attacks only.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-arrow-catching-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 509);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const catching = {
    id: "arrow-catching",
    label: "Arrow-Catching Shield",
    rows: [{ list: "features", values: { name: "Arrow-Catching Shield" } }],
    mechanics: {
      kind: "utility",
      reaction: { on: "aimed", for: "ally", within: 5, blow: "ranged" },
      takesAim: true,
    },
  };
  const features = [catching] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "shielded", label: "Shielded" });
    doc.combat.conditions.push({
      condition: "shielded",
      effects: [],
      modifiers: [{ to: "defense", flat: 2, blow: "ranged" }],
    });
    doc.catalogs.push({ id: "gear", label: "Gear", feeds: ["features"], entries: structuredClone(features) });
    edit(doc);
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
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "bite", name: "Bite", budget: "action", toHit: 5, reach: 5, damage: { flat: 4 } },
        { id: "bolt", name: "Bolt", budget: "action", toHit: 5, range: { normal: 120 }, damage: { flat: 4 } },
      ],
    }) as unknown as RulesetStatBlock;
  const sheet = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      fields: { level: 5, ac: 15, speed: 30, hp_max: 60 },
      lists: {
        features: features.flatMap((entry) =>
          rowsFromCatalogEntry("gear", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
        ),
      },
    });
  const fight = (allyAt: number, foeAt = 6): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "knight", name: "Knight", side: "party", build: sheet(), live: {}, catalogs: { gear: features } },
        {
          id: "ally",
          name: "Ally",
          side: "party",
          build: rulesetSheetBuildSchema.parse({ fields: { ac: 12 } }),
          live: {},
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) } as never,
        placements: { knight: { x: 1, y: 1 }, ally: { x: allyAt, y: 1 }, foe: { x: foeAt, y: 1 } },
      },
    });
    state.order = ["foe", "knight", "ally"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const attack = (state: RulesetEncounterState, optionId: string, target = "ally") =>
    applyRulesetCombatChoice(definition, state, { actorId: "foe", optionId, targetIds: [target] }, () => 10);
  const offers = (state: RulesetEncounterState) =>
    rulesetWindowOptions(definition, state, "knight").find((one) => one.label === "Arrow-Catching Shield");

  // ── A bolt at the ally beside them: the knight steps in and takes it ──
  {
    const aimed = attack(fight(2), "bolt");
    assert.equal(aimed.state.window?.trigger.kind, "aimed", JSON.stringify(aimed.events));
    const option = offers(aimed.state);
    assert.ok(option, "the shield is offered");
    const caught = applyRulesetCombatChoice(
      definition,
      aimed.state,
      { actorId: "knight", optionId: option.id, targetIds: [] },
      () => 10,
    );
    assert.deepEqual(
      of(caught.events, "tookAim").map((one) => [one.actorId, one.targetId, one.sourceId]),
      [["knight", "ally", "foe"]],
      JSON.stringify(caught.events),
    );
    let step = caught;
    const events = [...caught.events];
    for (let guard = 0; step.state.window && guard < 4; guard++) {
      const waiting = step.state.window.waiting[0]!;
      step = applyRulesetCombatChoice(
        definition,
        step.state,
        { actorId: waiting, optionId: RULESET_PASS_OPTION, targetIds: [] },
        () => 10,
      );
      events.push(...step.events);
    }
    assert.deepEqual(
      of(events, "attack").map((one) => one.targetId),
      ["knight"],
    );
  }

  // ── Not a bite, and not an ally three cells off ──
  {
    const bite = attack(fight(2, 3), "bite");
    assert.equal(bite.state.window && offers(bite.state), undefined, "a melee attack is no ranged one");
    const far = attack(fight(4), "bolt");
    assert.equal(far.state.window && offers(far.state), undefined, "an ally 15 feet off");
  }

  // ── +2 against a bolt, nothing against a bite ──
  {
    const state = fight(4, 2);
    rulesetCombatant(state, "knight")!.tracked.push({ condition: "shielded", rounds: null });
    const bolt = attack(structuredClone(state), "bolt", "knight");
    const bite = attack(structuredClone(state), "bite", "knight");
    const defense = (events: RulesetCombatEvent[]) => of(events, "attack")[0]?.defense;
    assert.equal(defense(bolt.events)! - defense(bite.events)!, 2, JSON.stringify([bolt.events, bite.events]));
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.catalogs.at(-1).entries[0].mechanics.reaction = { on: "hit", for: "ally", within: 5 })),
    /"takesAim" is taken at an "aimed" moment/,
  );
  refused(
    fiveE(
      (doc) =>
        (doc.combat.conditions.find((one: any) => one.condition === "shielded").modifiers = [
          { to: "saves", flat: 2, blow: "ranged" },
        ]),
    ),
    /"blow" narrows damage, attacks or defense only/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose reactions step in front of an attack aimed at somebody else, or whose defense counts against one kind of attack (takesAim, blow on a defense modifier or an aimed moment) requires schemaVersion 2 and capabilityApi 1.509 or newer";
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
    const shield = JSON.parse(fiveEText) as Record<string, any>;
    shield.catalogs.push({ id: "gear", label: "Gear", feeds: ["features"], entries: structuredClone(features) });
    assert.equal(getCapabilityPackageInstallIssue(manifest(508) as never, shield), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(509) as never, shield), gate);
    const guard = JSON.parse(fiveEText) as Record<string, any>;
    guard.combat.conditions[0].modifiers = [{ to: "defense", flat: 2, blow: "ranged" }];
    assert.equal(getCapabilityPackageInstallIssue(manifest(508) as never, guard), gate);
    const hit = JSON.parse(fiveEText) as Record<string, any>;
    hit.combat.conditions[0].modifiers = [{ to: "damage", flat: 2, blow: "ranged" }];
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(508) as never, hit), gate, "damage had blow before");
  }

  console.log(
    "Arrow-Catching Shield: its holder steps in to take a ranged attack aimed at an ally within 5 feet, not a melee one or a farther ally; +2 defense against ranged attacks only; gated at 1.509.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
