/**
 * Heads that die and grow back (Capability API 1.550).
 *
 *   - A hydra's Multiattack bites once per head: five targets to pick, four once a head has died.
 *   - Multiple Heads: 25 damage in one turn kills one head, once a turn; as its turn ends two grow
 *     for it and it regains 10 hit points for each, unless fire reached it since its last turn; down
 *     to one head it no longer holds what many heads give it; with none left it dies.
 *   - Reactive Heads: with its own reaction spent, a spare head still threatens an opportunity attack.
 *   - A strike per head on a creature without heads is refused, and the install gate.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  rulesetThreateningEnemies,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-heads-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 550);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hit = (id: string, label: string, damageType: string, flat: number) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
      mechanics: { kind: "attack", targets: "enemy", range: 120, autoHit: true, amount: { flat }, damageType },
    }) as unknown as RulesetCatalogEntry;
  const entries = [
    hit("cut", "Cut", "slashing", 25),
    hit("burn", "Burn", "fire", 1),
    hit("nick", "Nick", "slashing", 5),
  ];
  const fiveE = (perHeadWithout = false): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "many_heads", label: "Many Heads" });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    const multiattack = {
      id: "multiattack",
      name: "Multiattack",
      budget: "action",
      sequence: [{ action: "bite", perHead: true }],
    };
    const bite = { id: "bite", name: "Bite", budget: "action", toHit: 8, damage: { flat: 10 }, reach: 10 };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "hydra",
        label: "Hydra",
        creature: {
          health: 172,
          defense: 15,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_5",
          actions: [multiattack, bite],
          ...(perHeadWithout
            ? {}
            : {
                heads: {
                  count: 5,
                  lostAt: 25,
                  grows: 2,
                  growthStoppedBy: ["Fire"],
                  healsPerHead: 10,
                  opportunityReactions: true,
                  whileMany: ["many_heads"],
                },
              }),
        },
      });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const hydra = rulesetCreatureBlock(
    definition,
    definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "hydra"),
  );
  assert.ok(hydra?.heads);
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "hydra", name: "Hydra", side: "enemy", block: hydra },
      ],
      board: {
        grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
        placements: { mage: { x: 1, y: 1 }, hydra: { x: 6, y: 6 } },
      },
    });
    state.order = ["mage", "hydra"];
    state.turn = 0;
    return state;
  };
  const cast = (from: RulesetEncounterState, label: string) => {
    from.turn = 0;
    rulesetCombatant(from, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, from, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      from,
      { actorId: "mage", optionId: option.id, targetIds: ["hydra"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const endTurn = (from: RulesetEncounterState, actorId: string) => {
    const option = rulesetCombatOptions(definition, from, actorId).find((one) => one.kind === "end-turn");
    assert.ok(option, "no end of turn");
    return applyRulesetCombatChoice(definition, from, { actorId, optionId: option.id }, () => 10);
  };
  const heads = (from: RulesetEncounterState) => rulesetCombatant(from, "hydra")!.heads!.count;
  const hp = (from: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(from, "hydra")!).value;
  const holdsMany = (from: RulesetEncounterState) =>
    rulesetCombatant(from, "hydra")!.tracked.some((one) => one.condition === "many_heads");
  const biteTargets = (from: RulesetEncounterState) =>
    rulesetCombatOptions(definition, from, "hydra").find((one) => one.label === "Multiattack")?.targets.count;

  // ── Five heads, five bites, and what many heads give it ──
  const start = fight();
  assert.equal(heads(start), 5);
  assert.ok(holdsMany(start));
  start.turn = 1;
  assert.equal(biteTargets(start), 5);
  start.turn = 0;

  // ── 25 in one turn: one head dies, and only one however much more comes that turn ──
  const cut = cast(start, "Cut");
  assert.deepEqual(
    of(cut.events, "headLost").map((one) => one.left),
    [4],
  );
  const again = cast(cut.state, "Cut");
  assert.equal(heads(again.state), 4, "once a turn");
  assert.equal(hp(again.state), 122);
  again.state.turn = 1;
  assert.equal(biteTargets(again.state), 4, "a bite per head left");
  {
    const bites = rulesetCombatOptions(definition, again.state, "hydra").find((one) => one.label === "Multiattack")!;
    const near = structuredClone(again.state);
    Object.assign(rulesetCombatant(near, "mage")!, { x: 5, y: 6 });
    const bitten = applyRulesetCombatChoice(
      definition,
      near,
      { actorId: "hydra", optionId: bites.id, targetIds: ["mage"] },
      () => 10,
    );
    assert.equal(of(bitten.events, "attack").length, 4, JSON.stringify(bitten.events.map((one) => one.type)));
  }
  again.state.turn = 0;

  // ── As its turn ends, two grow back for it, 10 hit points each ──
  {
    const hydraTurn = endTurn(again.state, "mage").state;
    const grown = endTurn(hydraTurn, "hydra");
    assert.deepEqual(
      of(grown.events, "headsGrow").map((one) => [one.grown, one.heads, one.burned]),
      [[2, 6, undefined]],
    );
    assert.equal(heads(grown.state), 6);
    assert.equal(hp(grown.state), 142);
  }

  // ── Fire since its last turn: none grow ──
  {
    const burned = cast(cast(fight(), "Cut").state, "Burn");
    const hydraTurn = endTurn(burned.state, "mage").state;
    const ended = endTurn(hydraTurn, "hydra");
    assert.deepEqual(
      of(ended.events, "headsGrow").map((one) => [one.grown, one.burned]),
      [[0, true]],
    );
    assert.equal(heads(ended.state), 4);
  }

  // ── Down to one: no longer what many give it; none left: dead ──
  {
    const state = fight();
    rulesetCombatant(state, "hydra")!.heads!.count = 2;
    const one = cast(state, "Cut");
    assert.equal(heads(one.state), 1);
    assert.ok(!holdsMany(one.state), "one head holds what many give it no more");
    one.state.round += 1;
    const none = cast(one.state, "Cut");
    assert.equal(heads(none.state), 0);
    assert.ok(rulesetCombatant(none.state, "hydra")!.defeated, "with no head left it dies");
    assert.deepEqual(
      of(none.events, "slain").map((one) => one.targetId),
      ["hydra"],
    );
  }

  // ── Reactive Heads: its own reaction spent, a spare head still threatens ──
  {
    const state = fight();
    const near = rulesetCombatant(state, "mage")!;
    near.x = 5;
    near.y = 6;
    const threats = () =>
      rulesetThreateningEnemies(definition, definition.combat!, state, near).map((one) => one.combatant.id);
    const self = rulesetCombatant(state, "hydra")!;
    self.budgets.reaction = 0;
    assert.equal(self.heads!.spare, 4);
    assert.deepEqual(threats(), ["hydra"], "a spare head");
    self.heads!.spare = 0;
    assert.deepEqual(threats(), [], "none spare, none left");
  }

  // ── A strike per head without heads ──
  {
    const result = parseRulesetDefinition(fiveE(true));
    assert.ok(!result.ok);
    assert.ok(
      result.issues.some((issue) => issue.includes("A strike made once per head needs a creature with heads")),
      result.issues.join("; "),
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature whose heads die and grow back (heads, perHead) requires schemaVersion 2 and capabilityApi 1.550 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(549) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(550) as never, fiveE()), gate);
  }

  console.log(
    "Heads: a hydra bites once per head, loses one to 25 damage in a turn (once a turn), grows two back with 10 hit points each unless burned, loses what many heads give at one and dies at none, and a spare head still threatens with its reaction spent; gated at 1.550.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
