/**
 * An entry's save failed by a margin (Capability API 1.592): a Wand of Wonder's petrification.
 *
 *   - `save.failedBy`: a failure by 5 or more petrifies in place of the entry's `applies`; any other
 *     failure restrains; a success does nothing.
 *   - An unknown condition there is refused, and the install gate.
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
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-entry-failed-by-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 592);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = {
    id: "stone",
    label: "Stone Gaze",
    rows: [{ list: "spells", values: { name: "Stone Gaze", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      budget: "action",
      range: 60,
      save: {
        save: "con_save",
        onSuccess: "negates",
        failedBy: { atLeast: 5, applies: [{ condition: "petrified", duration: "until-dispelled" }] },
      },
      applies: [{ condition: "restrained", duration: { rounds: 10 } }],
    },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(spell)] });
    edit(doc);
    return doc;
  };
  const result = parseRulesetDefinition(document());
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
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
            abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 18 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "cha", slots_max_1: 4 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "orc",
          name: "Orc",
          side: "enemy",
          block: {
            health: 30,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            saves: { con_save: 0 },
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["mage", "orc"];
    state.turn = 0;
    return state;
  };
  const gaze = (face: number) => {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Stone Gaze");
    assert.ok(option, "offered");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option!.id, targetIds: ["orc"] },
      (sides) => (sides === 20 ? face : 3),
    );
    const save = step.events.find((one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save")!;
    return { save, holds: rulesetCombatant(step.state, "orc")!.tracked.map((one) => one.condition) };
  };

  // ── Failed by 5 or more: petrified, not restrained ──
  {
    const { save, holds } = gaze(1);
    assert.ok(save.difficulty - save.total >= 5, JSON.stringify(save));
    assert.ok(holds.includes("petrified"));
    assert.ok(!holds.includes("restrained"));
  }
  // ── Failed by less: restrained ──
  {
    const near = (() => {
      const probe = gaze(20).save;
      return probe.difficulty - (probe.total - 20) - 1;
    })();
    const { save, holds } = gaze(near);
    assert.equal(save.success, false);
    assert.ok(save.difficulty - save.total < 5, JSON.stringify(save));
    assert.ok(holds.includes("restrained"));
    assert.ok(!holds.includes("petrified"));
  }
  // ── Saved: nothing ──
  {
    const { save, holds } = gaze(20);
    assert.equal(save.success, true);
    assert.ok(!holds.includes("restrained") && !holds.includes("petrified"));
  }

  // ── Refusals ──
  const refused = parseRulesetDefinition(
    document((doc) => (doc.catalogs.at(-1).entries[0].mechanics.save.failedBy.applies[0].condition = "nonesuch")),
  );
  assert.ok(!refused.ok && refused.issues.some((one) => one.includes('Unknown condition "nonesuch"')));

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an entry's or item use's save failed by a margin (save.failedBy) requires schemaVersion 2 and capabilityApi 1.592 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(591) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(592) as never, document()), gate);
  }

  console.log(
    "Entry failedBy: petrified on a save failed by 5 or more, restrained on any other failure, nothing on a success; refusals; gated at 1.592.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
