/**
 * A condition put on for what was left of another (Capability API 1.616): 5e's Wind Walk, "a creature
 * can revert to its normal form ... it can use another action to turn back into a cloud", for the rest
 * of the spell's 8 hours.
 *
 *   - Reverting records what was left; the return entry puts it back for that, not its full rounds.
 *   - Not offered while under it, nor before any was left; time spent reverted is taken off.
 *   - Refused for an unknown condition; the install gate.
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
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-remaining-of-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 616);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics: { budget: "action", ...mechanics },
  });
  const document = (remainingOf = "wind_walking") => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        spell("revert", "Revert", { kind: "utility", targets: "self", endsCondition: "wind_walking" }),
        spell("cloud", "Become Cloud", {
          kind: "buff",
          targets: "self",
          applies: [{ condition: "wind_walking", duration: { rounds: 4800, remainingOf } }],
        }),
      ],
    });
    doc.sheet.live.conditions.push({ id: "wind_walking", label: "Wind Walking" });
    doc.combat.conditions.push({ condition: "wind_walking", effects: [], actions: ["spells/revert"] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
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
            abilities: { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 },
            fields: { level: 11, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int" },
            lists: {
              spells: entries
                .filter((entry) => entry.id === "cloud")
                .flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)),
            },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 20,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["mage", "wolf"];
    state.turn = 0;
    return state;
  };
  const mage = (state: RulesetEncounterState) => rulesetCombatant(state, "mage")!;
  const labels = (state: RulesetEncounterState) => {
    mage(state).budgets.action = 1;
    return rulesetCombatOptions(definition, state, "mage").map((one) => one.label);
  };
  const take = (state: RulesetEncounterState, label: string) => {
    mage(state).budgets.action = 1;
    const found = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(found, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: found.id, targetIds: ["mage"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step.state;
  };
  const windWalk = (state: RulesetEncounterState) =>
    mage(state).tracked.find((one) => one.condition === "wind_walking");

  // ── Nothing left yet: not offered ──
  {
    const state = fight();
    assert.ok(!labels(state).includes("Become Cloud"));
  }
  // ── Under it: not offered; revert, then back for what was left ──
  {
    let state = fight();
    mage(state).tracked.push({ condition: "wind_walking", rounds: 600 });
    assert.ok(!labels(state).includes("Become Cloud"));
    state = take(state, "Revert");
    assert.equal(windWalk(state), undefined);
    assert.ok(labels(state).includes("Become Cloud"), labels(state).join(", "));
    state = take(state, "Become Cloud");
    assert.equal(windWalk(state)?.rounds, 600);
    assert.ok(!labels(state).includes("Become Cloud"));
  }
  // ── Rounds spent reverted come off what is left ──
  {
    let state = fight();
    mage(state).tracked.push({ condition: "wind_walking", rounds: 600 });
    state = take(state, "Revert");
    state.round += 3;
    state = take(state, "Become Cloud");
    assert.equal(windWalk(state)?.rounds, 597);
  }
  // ── None left after waiting it out: not offered ──
  {
    let state = fight();
    mage(state).tracked.push({ condition: "wind_walking", rounds: 2 });
    state = take(state, "Revert");
    state.round += 2;
    assert.ok(!labels(state).includes("Become Cloud"));
  }

  // ── Refusal ──
  {
    const result = parseRulesetDefinition(document("mist_form"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Unknown condition "mist_form"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition put on for what was left of another (duration.remainingOf) requires schemaVersion 2 and capabilityApi 1.616 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(615) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(616) as never, document()), gate);
  }

  console.log(
    "remainingOf: Wind Walk back for what was left, less time spent reverted; not offered under it or with none left; refusal; gated at 1.616.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
