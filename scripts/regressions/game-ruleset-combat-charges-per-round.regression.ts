/**
 * An item use whose condition lasts while the item's charges do (Capability API 1.623): 5e's Boots
 * of Speed, "used for a total of 10 minutes".
 *
 *   - The use pays its own charge; each round its condition then holds spends one more, and it comes
 *     off with the last.
 *   - Ended early, the rest are kept for the next use.
 *   - Refusals; the install gate.
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
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-charges-per-round-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 623);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (opts: { charges?: boolean; applies?: boolean } = {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "hasted", label: "Boots of Speed" });
    doc.combat.conditions.push({ condition: "hasted", effects: [], endable: { budget: "bonus" } });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "boots",
          label: "Boots of Speed",
          item: {
            category: "gear",
            ...(opts.charges === false ? {} : { charges: { max: 3 }, stack: 1 }),
            use: {
              kind: "buff",
              budget: "bonus",
              label: "Click heels",
              targets: "self",
              charges: 1,
              chargesPerRound: true,
              ...(opts.applies === false ? {} : { applies: [{ condition: "hasted", duration: { rounds: 100 } }] }),
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
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const boots = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "runner",
          name: "Runner",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
          }),
          items: [{ item: boots, quantity: 1, worn: true, name: "Boots of Speed" }],
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
    state.order = ["runner", "wolf"];
    state.turn = 0;
    return state;
  };
  const runner = (state: RulesetEncounterState) => rulesetCombatant(state, "runner")!;
  const take = (state: RulesetEncounterState, label: RegExp) => {
    runner(state).budgets.bonus = 1;
    const option = rulesetCombatOptions(definition, state, "runner").find((one) => label.test(one.label));
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "runner")
        .map((one) => one.label)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "runner", optionId: option.id, targetIds: ["runner"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step.state;
  };
  const pass = (state: RulesetEncounterState) => {
    for (const id of ["runner", "wolf"]) {
      state = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: id, optionId: "end-turn", targetIds: [] },
        () => 10,
      ).state;
    }
    return state;
  };
  const hasted = (state: RulesetEncounterState) =>
    rulesetCombatConditions(definition, runner(state)).includes("hasted");
  const left = (state: RulesetEncounterState) => runner(state).charges?.[0];

  // ── Its own charge, then one a round, and off with the last ──
  {
    let state = take(fight(), /Click heels/);
    assert.ok(hasted(state));
    assert.equal(left(state), 2);
    state = pass(state);
    assert.equal(left(state), 1);
    assert.ok(hasted(state));
    state = pass(state);
    assert.equal(left(state), 0);
    assert.ok(!hasted(state), "off with the last charge");
  }
  // ── Ended early: the rest kept, and used again ──
  {
    let state = take(fight(), /Click heels/);
    state = take(state, /^End Boots of Speed$/);
    assert.ok(!hasted(state));
    assert.equal(left(state), 2);
    state = pass(state);
    assert.equal(left(state), 2, "nothing spent while off");
    state = take(state, /Click heels/);
    assert.equal(left(state), 1);
  }

  // ── Refusals ──
  refused(document({ charges: false }), /"chargesPerRound" spends the item's charges/);
  refused(document({ applies: false }), /"chargesPerRound" keeps up what it puts on/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item use whose condition lasts while the item's charges do (chargesPerRound) requires schemaVersion 2 and capabilityApi 1.623 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(622) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(623) as never, document()), gate);
  }

  console.log(
    "chargesPerRound: the Boots of Speed spend a charge a round and stop with the last; ended early, the rest kept; refusals; gated at 1.623.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
