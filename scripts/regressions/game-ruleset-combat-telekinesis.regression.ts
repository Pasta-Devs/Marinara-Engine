/**
 * A contest on a catalog entry, and a target moved where its user picks (Capability API 1.565):
 * 5e's Telekinesis.
 *
 *   - `mechanics.contest`: the caster's check against the target's; only on a win does the rest land.
 *   - `mechanics.movesTarget`: the target set down on a cell its option offered, within the distance
 *     of where it stood and the spell's range; with `up` lifted levels above the ground, kept up by a
 *     condition with `hover` and down again without one.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-telekinesis-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 565);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const telekinesis = (more: Record<string, unknown> = {}) => ({
    id: "telekinesis",
    label: "Telekinesis",
    rows: [{ list: "spells", values: { name: "Telekinesis", level: 5, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      budget: "action",
      range: 60,
      contest: { attacker: ["spellcasting"], defender: ["strength"] },
      movesTarget: { distance: 30, up: true },
      applies: [{ condition: "lifted", duration: { rounds: 1 } }],
      ...more,
    },
  });
  const document = (more?: Record<string, unknown>, hover = true) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "spellcasting", label: "Spellcasting", value: { abilityMod: "int" } },
      { id: "strength", label: "Strength", value: { abilityMod: "str" } },
    );
    doc.sheet.live.conditions.push({ id: "lifted", label: "Held by Telekinesis" });
    doc.combat.conditions.push({
      condition: "lifted",
      effects: ["own-attacks-disadvantage", "attacks-against-advantage", "speed-zero"],
      ...(hover ? { hover: true } : {}),
    });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [telekinesis(more)] });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const grid: TacticalGrid = {
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array.from({ length: 30 }, () => "plains")),
  };
  const ogre = (strength: number): RulesetStatBlock =>
    ({
      health: 59,
      defense: 11,
      initiativeModifier: 0,
      speed: 40,
      actions: [],
      checks: { strength },
    }) as unknown as RulesetStatBlock;
  const fight = (definition: RulesetDefinition, strength = 0) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "int", slots_max_5: 1 },
            lists: { spells: entries.flatMap((one) => rowsFromCatalogEntry("spells", one).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: ogre(strength) },
      ],
      board: { grid, placements: { wizard: { x: 2, y: 7 }, ogre: { x: 8, y: 7 } } },
    });
    state.order = ["wizard", "ogre"];
    state.turn = 0;
    return state;
  };
  const cast = (definition: RulesetDefinition, state: RulesetEncounterState, extra: Partial<RulesetCombatChoice>) => {
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Telekinesis");
    assert.ok(option, "Telekinesis is offered");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: ["ogre"], ...extra } as RulesetCombatChoice,
      () => 10,
    );
  };
  const at = (state: RulesetEncounterState) => {
    const ogre = rulesetCombatant(state, "ogre")!;
    return { x: ogre.x, y: ogre.y, ...(ogre.altitude !== undefined ? { altitude: ogre.altitude } : {}) };
  };
  const definition = parsed(document());

  // ── What the option offers: cells within 30 feet of the ogre and 60 of the wizard, 6 levels up ──
  {
    const state = fight(definition);
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Telekinesis")!;
    const cells = option.movesTarget!.cells.ogre!;
    assert.equal(option.movesTarget!.levels, 6);
    assert.ok(
      cells.some((cell) => cell.x === 14 && cell.y === 7),
      "30 feet on",
    );
    assert.ok(!cells.some((cell) => cell.x === 15 && cell.y === 7), "not 35");
    assert.ok(
      cells.some((cell) => cell.x === 8 && cell.y === 7),
      "where it stands, to lift it straight up",
    );
    assert.ok(!cells.some((cell) => cell.x === 2 && cell.y === 7), "not onto the wizard");
    // The board asks where once the ogre is picked, and offers those same cells.
    const [{ rulesetPicksStep }, { rulesetCarryCells }] = await Promise.all([
      import("../../packages/client/src/lib/ruleset-combat-menu.js"),
      import("../../packages/client/src/lib/ruleset-combat-board.js"),
    ]);
    const view = { options: [option], combatants: [] } as never;
    assert.equal(rulesetPicksStep(view, { stage: "target", option, targets: [] } as never, ["ogre"])?.stage, "carry");
    assert.deepEqual(rulesetCarryCells(option as never, ["ogre"]), cells);
  }

  // ── Won (Int +4 against Strength +0, both 10): moved, held and lifted ──
  {
    const step = cast(definition, fight(definition), { to: { x: 12, y: 4 }, rises: 2 });
    assert.deepEqual(of(step.events, "refused"), []);
    const contest = of(step.events, "contest")[0]!;
    assert.equal(contest.winner, "actor");
    assert.equal(contest.attacker.total, 14);
    assert.deepEqual(at(step.state), { x: 12, y: 4, altitude: 2 });
    assert.deepEqual(
      of(step.events, "carried").map((one) => ({ from: one.from, to: one.to, rises: one.rises })),
      [{ from: { x: 8, y: 7 }, to: { x: 12, y: 4 }, rises: 2 }],
    );
    assert.ok(rulesetCombatant(step.state, "ogre")!.tracked.some((one) => one.condition === "lifted"));
  }

  // ── Won without a cell: held where it stands ──
  {
    const step = cast(definition, fight(definition), {});
    assert.deepEqual(at(step.state), { x: 8, y: 7 });
    assert.equal(of(step.events, "carried").length, 0);
    assert.ok(rulesetCombatant(step.state, "ogre")!.tracked.some((one) => one.condition === "lifted"));
  }

  // ── Lost (Strength +9): neither moved nor held ──
  {
    const step = cast(definition, fight(definition, 9), { to: { x: 12, y: 4 }, rises: 2 });
    assert.deepEqual(of(step.events, "refused"), []);
    assert.equal(of(step.events, "contest")[0]!.winner, "target");
    assert.deepEqual(at(step.state), { x: 8, y: 7 });
    assert.ok(!rulesetCombatant(step.state, "ogre")!.tracked.some((one) => one.condition === "lifted"));
  }

  // ── Nothing keeping it up: lifted, and down again at once ──
  {
    const bare = parsed(document(undefined, false));
    const step = cast(bare, fight(bare), { to: { x: 12, y: 4 }, rises: 2 });
    assert.deepEqual(of(step.events, "refused"), []);
    assert.deepEqual(at(step.state), { x: 12, y: 4 });
  }

  // ── Only where its option offered, and no higher than it carries ──
  {
    const refusal = (extra: Partial<RulesetCombatChoice>) =>
      of(cast(definition, fight(definition), extra).events, "refused")[0]?.reason;
    assert.equal(refusal({ to: { x: 15, y: 7 } }), "bad-cell");
    assert.equal(refusal({ to: { x: 12, y: 4 }, rises: 7 }), "bad-cell");
    assert.equal(refusal({ rises: 2 }), "bad-cell");
    assert.equal(refusal({ to: { x: 12, y: 4 }, rises: 1.5 }), "bad-cell");
    const flat = parsed(document({ movesTarget: { distance: 30 } }));
    assert.equal(
      of(cast(flat, fight(flat), { to: { x: 12, y: 4 }, rises: 1 }).events, "refused")[0]?.reason,
      "bad-cell",
    );
  }

  // ── Refusals ──
  refused(document({ save: { save: "str_save", onSuccess: "negates" } }), /"contest" decides who it lands on/);
  refused(document({ attackRoll: true }), /"contest" decides who it lands on/);
  refused(document({ targetCount: 2 }), /"movesTarget" moves the one creature/);
  refused(document({ targets: "self" }), /"movesTarget" moves the one creature/);
  refused(document({ contest: { attacker: ["arcana"], defender: ["strength"] } }), /Unknown check "arcana"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an entry won by a contest of checks or one that moves its target where its user picks (mechanics.contest, movesTarget) requires schemaVersion 2 and capabilityApi 1.565 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(564) as never, document()), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(564) as never, document({ contest: undefined })), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(564) as never, document({ movesTarget: undefined, applies: [] })),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(565) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(564) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Telekinesis: a contest of checks decides it, the ogre moved where picked within 30 feet and lifted, held up by a hover condition and down without one, untouched on a loss; refusals; gated at 1.565.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
