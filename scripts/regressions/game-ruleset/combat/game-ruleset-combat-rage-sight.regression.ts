/**
 * Six conditions at once, and sight that is really seeing (Capability API 1.277).
 *
 *   - `applies` holds up to 6 on a catalog entry, an item use and a creature action (4 before):
 *     Rage and Frenzy each add Mindless Rage's condition beside their four.
 *   - `whileSourceInSight` reads the holder's own sight, as an aura's `orSeen` does: a blinded
 *     holder, or a source it cannot see (invisible), no longer "sees" the source of its fear.
 *   - A condition its holder's own condition holds off is not cured by the immunity that condition
 *     gives (1.278): a fright on when a rage begins is suspended and back when the rage ends.
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
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rage-sight-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 272);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const marks = ["mark_a", "mark_b", "mark_c", "mark_d", "mark_e", "mark_f"];
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const sixfold = spell("sixfold", {
    kind: "buff",
    targets: "self",
    applies: marks.map((condition) => ({ condition, duration: { rounds: 10 } })),
  });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    for (const id of marks) {
      doc.sheet.live.conditions.push({ id, label: id });
      doc.combat.conditions.push({ condition: id, effects: [] });
    }
    // Blinded takes the eyes away, and nobody sees the invisible.
    doc.combat.sight = { eyes: "sight" };
    doc.combat.senses ??= [];
    if (!doc.combat.senses.some((one: { id: string }) => one.id === "truesight"))
      doc.combat.senses.push({ id: "truesight", label: "Truesight" });
    for (const entry of doc.combat.conditions) {
      if (entry.condition === "blinded") entry.lacks = ["sight"];
      if (entry.condition === "invisible") entry.unseen = { pierced: ["truesight"] };
    }
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown) => parseRulesetDefinition(doc);
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parse(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parse(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(
    fiveE((doc) => doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [sixfold] })),
  );
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: rowsFromCatalogEntry("spells", sixfold).map((row) => row.row) },
  });
  const block = (): RulesetStatBlock => ({
    health: 30,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, catalogs: { spells: [sixfold] } },
        { id: "ghost", name: "Ghost", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) } as never,
        placements: { hero: { x: 1, y: 1 }, ghost: { x: 6, y: 1 } },
      },
    });
    state.order = ["hero", "ghost"];
    state.turn = 0;
    return state;
  };

  // ── Six conditions put on at once ──
  {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Sixfold");
    assert.ok(option, "the hero may cast it");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option!.id, targetIds: ["hero"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
    );
    const on = rulesetCombatConditions(definition, rulesetCombatant(step.state, "hero")!);
    for (const mark of marks) assert.ok(on.includes(mark), `${mark} is on`);
  }

  // ── Frightened only while its holder really sees its source ──
  {
    const effects = (state: RulesetEncounterState) =>
      rulesetActiveConditions(definition, definition.combat!, rulesetCombatant(state, "hero")!, state)
        .filter((one) => one.condition === "frightened")
        .flatMap((one) => one.effects);
    const scared = () => {
      const state = fight();
      rulesetCombatant(state, "hero")!.tracked.push({
        condition: "frightened",
        rounds: null,
        source: "ghost",
      } as never);
      return state;
    };
    assert.ok(effects(scared()).includes("own-attacks-disadvantage"), "seen: afraid");
    const blind = scared();
    rulesetCombatant(blind, "hero")!.tracked.push({ condition: "blinded", rounds: null } as never);
    assert.ok(!effects(blind).includes("own-attacks-disadvantage"), "blinded: the source is out of sight");
    const unseen = scared();
    rulesetCombatant(unseen, "ghost")!.tracked.push({ condition: "invisible", rounds: null } as never);
    assert.ok(!effects(unseen).includes("own-attacks-disadvantage"), "an invisible source is out of sight");
  }

  // ── A rage holds a fright already on off, and it comes back after (1.278) ──
  {
    const raging = parsed(
      fiveE((doc) => {
        doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [sixfold] });
        doc.sheet.live.conditions.push({ id: "raging", label: "Raging" });
        doc.combat.conditions.push({
          condition: "raging",
          effects: [],
          conditionImmunities: ["frightened"],
          suppresses: ["frightened"],
        });
      }),
    );
    const state = fight();
    const hero = rulesetCombatant(state, "hero")!;
    hero.tracked.push({ condition: "frightened", rounds: null, source: "ghost" } as never);
    hero.tracked.push({ condition: "raging", rounds: null } as never);
    const option = rulesetCombatOptions(raging, state, "hero").find((one) => one.label === "Sixfold")!;
    const step = applyRulesetCombatChoice(
      raging,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["hero"] },
      () => 10,
    );
    const after = rulesetCombatant(step.state, "hero")!;
    assert.ok(
      after.tracked.some((one) => one.condition === "frightened"),
      "suspended, not cured",
    );
    const held = (combatant: typeof after) =>
      rulesetActiveConditions(raging, raging.combat!, combatant, step.state).some(
        (one) => one.condition === "frightened",
      );
    assert.equal(held(after), false, "held off while raging");
    after.tracked = after.tracked.filter((one) => one.condition !== "raging");
    assert.equal(held(after), true, "back once the rage ends");
    // Immune without holding it off: cured, as before.
    const cures = parsed(
      fiveE((doc) => {
        doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [sixfold] });
        doc.sheet.live.conditions.push({ id: "raging", label: "Raging" });
        doc.combat.conditions.push({ condition: "raging", effects: [], conditionImmunities: ["frightened"] });
      }),
    );
    const plain = fight();
    rulesetCombatant(plain, "hero")!.tracked.push({ condition: "frightened", rounds: null, source: "ghost" } as never);
    rulesetCombatant(plain, "hero")!.tracked.push({ condition: "raging", rounds: null } as never);
    const cureOption = rulesetCombatOptions(cures, plain, "hero").find((one) => one.label === "Sixfold")!;
    const cured = applyRulesetCombatChoice(
      cures,
      plain,
      { actorId: "hero", optionId: cureOption.id, targetIds: ["hero"] },
      () => 10,
    );
    assert.ok(!rulesetCombatant(cured.state, "hero")!.tracked.some((one) => one.condition === "frightened"), "cured");
  }

  // ── Import ──
  {
    const seven = spell("seven", {
      kind: "buff",
      applies: [...marks, "blinded"].map((condition) => ({ condition, duration: { rounds: 1 } })),
    });
    refused(
      fiveE((doc) => doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [seven] })),
      /applies/,
    );
    const fiveActions = {
      ...block(),
      actions: [
        {
          id: "howl",
          name: "Howl",
          budget: "action",
          save: { save: "wis_save", difficulty: 12, onSuccess: "negates" },
          applies: marks.slice(0, 5).map((condition) => ({ condition, duration: { rounds: 1 } })),
        },
      ],
    };
    parsed(
      fiveE((doc) =>
        doc.catalogs.push({
          id: "beasts",
          label: "Beasts",
          holds: "creatures",
          entries: [{ id: "d", label: "D", creature: { ...fiveActions, tier: "cr_0" } }],
        }),
      ),
    );
  }

  // ── The install gate ──
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
      "A ruleset with a spell, an item or a creature action that puts on more than four conditions requires schemaVersion 2 and capabilityApi 1.277 or newer";
    const withSpell = (count: number) =>
      fiveE((doc) =>
        doc.catalogs.push({
          id: "x",
          label: "X",
          entries: [spell("s", { kind: "buff", applies: marks.slice(0, count).map((condition) => ({ condition })) })],
        }),
      );
    assert.equal(getCapabilityPackageInstallIssue(manifest(276) as never, withSpell(5)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(277) as never, withSpell(5)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(276) as never, withSpell(4)), gate, "four is older");
  }

  console.log(
    "Ruleset rage and sight: an entry puts on six conditions at once, and a fright holds only while its holder really sees its source; gated at 1.277.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
