/**
 * An item used on past its last charge (Capability API 1.624): 5e's Wind Fan, once a dawn and then
 * "a cumulative 20 percent chance of not working and tearing into useless, nonmagical tatters".
 *
 *   - Its use is still offered with no charges left; each such use rolls a d100 against its chance,
 *     20 and then 40, and at or under it the fan tears: gone, and the use does nothing.
 *   - The count is kept on its stack through the fight's write-back, read back in the next fight, and
 *     starts over when a rest brings its charge back.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  parseRulesetDefinition,
  rechargeRulesetItems,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type GameInventoryStack,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-overuse-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 624);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "gusted", label: "Gusted" });
    doc.combat.conditions.push({ condition: "gusted", effects: [] });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "fan",
          label: "Wind Fan",
          item: {
            category: "gear",
            stack: 1,
            charges: {
              max: 1,
              recharge: { rests: ["long"], amount: "max" },
              overuse: { chance: 20, cumulative: true },
            },
            use: {
              kind: "buff",
              budget: "action",
              label: "Gust",
              targets: "self",
              charges: 1,
              applies: [{ condition: "gusted", duration: { rounds: 10 } }],
            },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const fan = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const fight = (held: { charges?: number; usesLeft?: Record<string, number> } = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "fanner",
          name: "Fanner",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
          }),
          items: [
            {
              item: fan,
              quantity: 1,
              name: "Wind Fan",
              stack: { id: "s-fan", ref: "kit/fan" },
              ...held,
            },
          ],
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 20,
            defense: 12,
            initiativeModifier: 0,
            speed: 40,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["fanner", "wolf"];
    state.turn = 0;
    return state;
  };
  const fanner = (state: RulesetEncounterState) => rulesetCombatant(state, "fanner")!;
  const gustOption = (state: RulesetEncounterState) => {
    const working = structuredClone(state);
    rulesetCombatant(working, "fanner")!.budgets.action = 1;
    return rulesetCombatOptions(definition, working, "fanner").find((one) => /Gust/.test(one.label));
  };
  /** Uses the fan, its d100 coming up `d100`; the step's events. */
  const gust = (state: RulesetEncounterState, d100 = 100) => {
    const working = structuredClone(state);
    rulesetCombatant(working, "fanner")!.budgets.action = 1;
    const option = gustOption(working);
    assert.ok(
      option,
      rulesetCombatOptions(definition, working, "fanner")
        .map((one) => one.label)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      working,
      { actorId: "fanner", optionId: option.id, targetIds: ["fanner"] },
      (sides: number) => (sides === 100 ? d100 : 10),
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const gusted = (state: RulesetEncounterState) =>
    rulesetCombatConditions(definition, fanner(state)).includes("gusted");
  const unGust = (state: RulesetEncounterState) => {
    const one = fanner(state);
    one.tracked = one.tracked.filter((entry) => entry.condition !== "gusted");
    if (one.sheet)
      one.sheet.live = {
        ...one.sheet.live,
        conditions: (one.sheet.live.conditions ?? []).filter((id) => id !== "gusted"),
      };
    return state;
  };

  // ── Once on its charge, then on none: 20%, then 40%, torn at or under ──
  let afterHolding: RulesetEncounterState;
  {
    const start = fight();
    let step = gust(start);
    assert.equal(fanner(step.state).charges?.[0], 0);
    assert.ok(gusted(step.state));
    assert.equal(fanner(step.state).usesLeft?.["0:o"], undefined, "a use on its charge is no overuse");
    // Still offered with none left.
    let state = unGust(step.state);
    assert.ok(gustOption(state), "offered past its last charge");
    // The first use on none: 20%. A 21 holds.
    step = gust(state, 21);
    assert.equal(
      step.events.find((one) => one.type === "broke"),
      undefined,
    );
    assert.ok(gusted(step.state), "it worked");
    assert.equal(fanner(step.state).usesLeft?.["0:o"], 1);
    afterHolding = step.state;
    // The second: 40%. A 40 tears it, and it does nothing.
    state = unGust(step.state);
    step = gust(state, 40);
    const broke = step.events.find((one) => one.type === "broke");
    assert.ok(broke && broke.type === "broke" && broke.roll === 40, JSON.stringify(step.events));
    assert.ok(!gusted(step.state), "torn, it did nothing");
    assert.equal(gustOption(step.state), undefined, "gone for good");
    // Written back: the stack is gone.
    const stacks: GameInventoryStack[] = [{ id: "s-fan", name: "Wind Fan", item: "kit/fan", quantity: 1, charges: 0 }];
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(start, step.state));
    assert.ok(written);
    assert.equal(written.stacks.length, 0);
  }
  // ── Not cumulative past its chance: a 41 on the second holds ──
  {
    const step = gust(unGust(afterHolding), 41);
    assert.equal(
      step.events.find((one) => one.type === "broke"),
      undefined,
    );
    assert.equal(fanner(step.state).usesLeft?.["0:o"], 2);
  }
  // ── Kept on the stack, read back, and cleared by a rest ──
  {
    const start = fight();
    const stacks: GameInventoryStack[] = [{ id: "s-fan", name: "Wind Fan", item: "kit/fan", quantity: 1 }];
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(start, afterHolding));
    assert.ok(written);
    assert.deepEqual(
      { charges: written.stacks[0]!.charges, usesLeft: written.stacks[0]!.usesLeft },
      { charges: 0, usesLeft: { o: 1 } },
    );
    // The next fight reads it: the next use on none is the second, 40%.
    const next = fight({ charges: 0, usesLeft: { o: 1 } });
    const step = gust(next, 40);
    assert.ok(step.events.some((one) => one.type === "broke"));
    // A long rest gives the charge back and starts the count over.
    const rested = rechargeRulesetItems({
      definition,
      itemOf: (ref) => (ref === "kit/fan" ? ({ name: "Wind Fan", entry: { item: fan } } as never) : undefined),
      stacks: written.stacks,
      holder: undefined,
      rest: "long",
      roll: () => 1,
    });
    assert.equal(rested.stacks[0]!.charges, undefined, "full again");
    assert.equal(rested.stacks[0]!.usesLeft, undefined, "the count starts over");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item used on past its last charge (charges.overuse) requires schemaVersion 2 and capabilityApi 1.624 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(623) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(624) as never, document()), gate);
  }

  console.log(
    "overuse: the Wind Fan is offered past its charge, 20% then 40% to tear for nothing; the count kept on its stack and cleared by a rest; gated at 1.624.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
