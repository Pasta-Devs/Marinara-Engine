/**
 * A blow's own dice thrown more times over, and a creature's own action on itself (Capability API
 * 1.197), as an enlarged duergar has them.
 *
 *   - A creature's action with `self: true` taken on its turn lands on the creature: its `applies` go on.
 *   - A damage modifier's `diceTimes`: the blow's own dice that many times over, its flat part as it
 *     was, doubled again on a critical, and counted in the menu's average. Narrowed as any damage
 *     modifier is.
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-dice-times-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 192);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const enlarged = {
    condition: "duergar_enlarged",
    size: { steps: 1 },
    modifiers: [{ to: "damage", attacks: "weapon", ability: "str", diceTimes: 2 }],
  };
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.combat.sizes = {
      order: [
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
      ],
      default: "medium",
    };
    doc.sheet.live.conditions.push({ id: "duergar_enlarged", label: "Enlarged" });
    doc.combat.conditions.push(structuredClone(enlarged));
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const duergar: RulesetStatBlock = {
    health: 60,
    defense: 12,
    initiativeModifier: 20,
    speed: 25,
    actions: [
      {
        id: "enlarge",
        name: "Enlarge",
        budget: "action",
        self: true,
        applies: [{ condition: "duergar_enlarged", duration: { rounds: 10 } }],
        uses: { per: "encounter", count: 1 },
      },
      {
        id: "pick",
        name: "War Pick",
        budget: "action",
        toHit: 4,
        ability: "str",
        damage: { count: 1, sides: 8, flat: 2 },
      },
      { id: "dart", name: "Dart", budget: "action", toHit: 4, ability: "dex", damage: { count: 1, sides: 4, flat: 2 } },
    ],
  } as RulesetStatBlock;
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 5, speed: 30, hp_max: 200 },
          }),
          live: {},
        },
        { id: "duergar", name: "Duergar", side: "enemy", block: duergar },
      ],
    });
    state.turn = state.order.indexOf("duergar");
    return state;
  };
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "duergar").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "duergar").map((one) => one.label)}`);
    return option;
  };
  const use = (state: RulesetEncounterState, label: string, targetIds: string[] = []) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "duergar", optionId: optionOf(state, label).id, targetIds },
      roll,
    );
  const dealt = (events: RulesetCombatEvent[]) =>
    events.reduce((sum, one) => sum + (one.type === "damage" && one.targetId === "hero" ? one.amount : 0), 0);
  const enlarge = () => {
    const step = use(fight(), "Enlarge");
    const state = step.state;
    rulesetCombatant(state, "duergar")!.budgets.action = 1;
    return { step, state };
  };

  // ── Enlarge taken on its turn lands on the duergar itself ──
  {
    const { step, state } = enlarge();
    assert.ok(
      rulesetCombatConditions(definition, rulesetCombatant(state, "duergar")!).includes("duergar_enlarged"),
      JSON.stringify(step.events),
    );
    assert.ok(step.events.some((one) => one.type === "condition" && one.targetId === "duergar"));
    assert.equal(rulesetCombatant(state, "duergar")!.uses.enlarge, 0, "its one use is spent");
  }

  // ── Its war pick throws its die twice, its flat part once ──
  {
    d20 = 15;
    assert.equal(dealt(use(fight(), "War Pick", ["hero"]).events), 5, "1d8 + 2 before");
    const { state } = enlarge();
    const hit = use(state, "War Pick", ["hero"]);
    assert.equal(dealt(hit.events), 8, "2d8 + 2: 3 + 3 + 2");
    // The menu counts them: 4.5 more on average.
    const before = optionOf(fight(), "War Pick").forecast?.averageDamage ?? 0;
    const after = optionOf(enlarge().state, "War Pick").forecast?.averageDamage ?? 0;
    assert.deepEqual([before, after], [6.5, 11]);
    // A critical doubles all of them: four dice, and the 2.
    d20 = 20;
    assert.equal(dealt(use(enlarge().state, "War Pick", ["hero"]).events), 14);
    d20 = 15;
    // Its dexterity dart is not a Strength blow, so is as it was.
    assert.equal(dealt(use(enlarge().state, "Dart", ["hero"]).events), 5);
  }

  // ── Refusals and the gate ──
  {
    const refused = (change: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        document((doc) => Object.assign(doc.combat.conditions.at(-1).modifiers[0], change)),
      );
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    refused({ diceTimes: 1 }, /diceTimes/);
    refused({ diceTimes: 5 }, /diceTimes/);
    refused({ diceTimes: 1.5 }, /diceTimes/);
    refused({ to: "damage-taken" }, /"diceTimes" changes the damage a blow deals only/);
    refused(
      { to: "attacks", attacks: undefined, ability: undefined },
      /"diceTimes" changes the damage a blow deals only/,
    );
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
      "A ruleset with damage modifiers that throw a blow's own dice more times over requires schemaVersion 2 and capabilityApi 1.197 or newer";
    const doubled = document((doc) => delete doc.combat.conditions.at(-1).size);
    assert.equal(getCapabilityPackageInstallIssue(manifest(196) as never, doubled), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(197) as never, doubled), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(196) as never, JSON.parse(fiveEText)), gate);
    const files = new Map([
      ["items.json", { entries: [{ item: { worn: { modifiers: [{ to: "damage", diceTimes: 2 }] } } }] }],
    ]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(196) as never, JSON.parse(fiveEText), files as never), gate);
  }

  console.log(
    "Ruleset dice times: an enlarged duergar's Enlarge lands on itself, and its war pick throws 2d8 + 2, four dice on a critical.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
